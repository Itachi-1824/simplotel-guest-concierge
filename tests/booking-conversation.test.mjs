import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion,checkAvailability,validateStay} from '../src/lib/assistant.mjs';
import {resolveStay} from '../src/lib/query-plan.mjs';
import {matchRooms,normalizePreferences} from '../src/lib/room-preferences.mjs';
import {createQuote} from '../src/lib/booking.mjs';

const now=new Date('2026-09-23T12:00:00Z');
const original='Can you book a room for 2 from oct 7–12 please';
const history=[{role:'user',content:original}];
const stay={checkIn:'2026-10-07',checkOut:'2026-10-12',adults:2};
const context={stay,preferences:normalizePreferences()};

test('the reported booking request includes both dates and the guest count',async()=>{
  for(const dash of ['-','–','—']){
    const question=original.replace('–',dash);
    assert.deepEqual(resolveStay(question,[],{},now),stay);
    const result=await answerQuestion({question},{now});
    assert.equal(result.type,'availability');
    assert.equal(result.availability.adults,2);
    assert.equal(result.availability.checkOut,'2026-10-12');
  }
});

test('a day range and bare word count reuse the established month',async()=>{
  const result=await answerQuestion({question:'5–7, two',history,bookingContext:context},{now});
  assert.deepEqual(result.bookingPlan.stay,{checkIn:'2026-10-05',checkOut:'2026-10-07',adults:2});
  assert.equal(result.bookingPlan.roomId,'classic');
  assert.equal(createQuote(result.bookingPlan,now).quote.guests,2);
});

test('the reported two-not-four correction is a guest update, not a child policy question',async()=>{
  const result=await answerQuestion({question:'need smth only for 2 not 4',history,bookingContext:{...context,stay:{...stay,adults:4}}},{now});
  assert.equal(result.type,'availability');
  assert.equal(result.availability.adults,2);
  assert.deepEqual(result.sources,[]);
  assert.doesNotMatch(result.answer,/cot|child under/i);
});

test('availability follow-ups preserve stay length, guests, and preferences',async()=>{
  const first=await answerQuestion({question:'oct 7–12 3 guests with breakfast included'},{now});
  assert.equal(first.availability.rooms.length,0);
  const bookingContext={stay:{checkIn:first.availability.checkIn,checkOut:first.availability.checkOut,adults:3},preferences:first.availability.preferences};
  for(const question of ['hmm anything thats available?','Anything else available?','Any other options?','What else is available?']){
    const result=await answerQuestion({question,bookingContext},{now});
    assert.equal(result.type,'availability');
    assert.equal(result.availability.nights,5);
    assert.equal(result.availability.adults,3);
    assert.equal(result.availability.preferences.breakfastIncluded,true);
    assert.equal(result.bookingPlan,undefined);
    assert.ok(result.availability.alternatives.length>0);
    assert.doesNotMatch(result.answer,/parking/i);
    for(const option of result.availability.alternatives){
      assert.equal(option.adults,3);
      assert.equal(option.nights,5);
      assert.notEqual(option.checkIn,bookingContext.stay.checkIn);
      const checked=checkAvailability(validateStay(option,now));
      assert.ok(matchRooms(checked.rooms,bookingContext.preferences).some(room=>room.id===option.room.id));
      assert.equal(createQuote({roomId:option.room.id,stay:option,preferences:bookingContext.preferences},now).ok,true);
    }
  }
});

test('explicit hotel service questions keep their own topic during booking',async()=>{
  for(const [question,source] of [['Is parking available?','parking'],['Is breakfast included?','breakfast'],['Can I request a cot for a child under 2?','cot']]){
    const result=await answerQuestion({question,history,bookingContext:context},{now});
    assert.equal(result.type,'answer');
    assert.ok(result.sources.some(item=>item.id===source));
  }
});

test('night counts, prices, and child ages are not parsed as guest counts',()=>{
  for(const question of ['for 2 nights','for 24 euros','a child of 2 years','for 7 October'])assert.equal(resolveStay(question,[],{},now).adults,undefined);
});

test('single-number replies update the active stay',async()=>{
  const result=await answerQuestion({question:'2',bookingContext:{...context,stay:{...stay,adults:4}}},{now});
  assert.equal(result.type,'availability');
  assert.equal(result.availability.adults,2);
});

test('guest corrections reject negated counts and preserve both dates',async()=>{
  for(const question of ['actually 2','just two','make it 2','we are two','two please','2 not 4','not 4 guests, 2 guests','2 guests, not 4 guests','for 2 not 4 guests']){
    const result=await answerQuestion({question,bookingContext:{...context,stay:{...stay,adults:4}}},{now});
    assert.equal(result.type,'availability',question);
    assert.equal(result.availability.adults,2,question);
    assert.equal(result.availability.checkIn,stay.checkIn,question);
    assert.equal(result.availability.checkOut,stay.checkOut,question);
  }
});

test('shorthand dates without a known month ask for dates instead of retrieving numeric facts',async()=>{
  const result=await answerQuestion({question:'5–7, two'},{now});
  assert.equal(result.type,'availability-needed');
  assert.equal(result.stay.adults,2);
  assert.ok(result.missing.includes('checkIn'));
});

test('invalid corrections cannot create a booking plan',async()=>{
  for(const question of ['0 guests','5 guests','2026-02-30 to 2026-03-02','2026-10-12 to 2026-10-07','2026-10-07 to 2026-11-20']){
    const result=await answerQuestion({question,bookingContext:context},{now});
    assert.equal(result.type,'availability-needed',question);
    assert.equal(result.bookingPlan,undefined);
  }
});

test('duration and departure corrections recompute a valid stay',async()=>{
  for(const [question,checkOut] of [['Actually three nights','2026-10-10'],['Leaving 14 October','2026-10-14']]){
    const result=await answerQuestion({question,bookingContext:context},{now});
    assert.equal(result.type,'availability');
    assert.equal(result.availability.checkOut,checkOut);
    assert.equal(result.availability.adults,2);
  }
});

test('explicit form values win over earlier conversational details',async()=>{
  const form={checkIn:'2026-10-05',checkOut:'2026-10-07',adults:3};
  const result=await answerQuestion({question:'Check availability',bookingContext:context,stay:form,preferences:{nightlyBudget:400,view:'terrace',breakfastIncluded:true}},{now});
  assert.equal(result.availability.adults,3);
  assert.equal(result.availability.checkIn,form.checkIn);
  assert.deepEqual(result.availability.rooms.map(room=>room.id),['terrace']);
});

test('saved booking context outlives the short retrieval history without reverting corrections',async()=>{
  const stale=[{role:'user',content:'Book for 4 guests with breakfast included and a sea view'}];
  const corrected={stay,preferences:normalizePreferences({breakfastIncluded:false,view:'any'})};
  const result=await answerQuestion({question:'Any availability?',history:stale,bookingContext:corrected},{now});
  assert.equal(result.availability.adults,2);
  assert.deepEqual(result.availability.preferences,corrected.preferences);
});

test('vague availability without an active stay asks for clarification',async()=>{
  const result=await answerQuestion({question:'anything available?'},{now});
  assert.equal(result.type,'clarification');
  assert.deepEqual(result.sources,[]);
});

test('nearby options never relax the budget or return dates in the past',async()=>{
  const result=await answerQuestion({question:'Book a room for 2 from 24–29 September 2026 under €100 per night'},{now});
  assert.deepEqual(result.availability.alternatives,[]);
  const second=await answerQuestion({question:'Book a room for 3 from 24–29 September 2026'},{now});
  for(const option of second.availability.alternatives||[])assert.ok(option.checkIn>='2026-09-23');
});
