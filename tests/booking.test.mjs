import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion,checkAvailability,hotel,validateStay} from '../src/lib/assistant.mjs';
import {createQuote} from '../src/lib/booking.mjs';
import {applyClassifierPreferences,matchRooms,normalizePreferences,resolvePreferences,classifyPreferences,LAYA_ROLE} from '../src/lib/room-preferences.mjs';
import {resolveStay,hotelToday} from '../src/lib/query-plan.mjs';

const now=new Date('2026-10-01T12:00:00Z');
const stay={checkIn:'2026-10-05',checkOut:'2026-10-07',adults:3};

test('preferences filter by budget, documented outdoor space and breakfast',()=>{
  const rooms=checkAvailability(validateStay(stay,now)).rooms;
  const matches=matchRooms(rooms,normalizePreferences({nightlyBudget:400,view:'terrace',breakfastIncluded:true}));
  assert.deepEqual(matches.map(room=>room.id),['terrace']);
  assert.equal(matchRooms(rooms,normalizePreferences({nightlyBudget:100})).length,0);
  assert.equal(matchRooms(rooms,normalizePreferences({view:'sea'})).length,0);
});

test('natural-language booking intent retains explicit preferences while asking for dates',async()=>{
  const result=await answerQuestion({question:'Help me book a room for 3 guests under €400 per night with a terrace and with breakfast included'},{now});
  assert.equal(result.type,'availability-needed');
  assert.deepEqual(result.preferences,{nightlyBudget:400,view:'terrace',breakfastIncluded:true,roomId:null});
  assert.ok(result.missing.includes('checkIn'));
  assert.equal(result.stay.adults,3);
});

test('room preferences persist across a date follow-up and can be cleared explicitly',()=>{
  const history=[{role:'user',content:'Find a room with a sea view under €300 per night'}];
  assert.equal(resolvePreferences('2026-10-05 to 2026-10-07',history).view,'sea');
  assert.equal(resolvePreferences('Book a room', [{role:'user',content:'Tell me about the Terrace Suite'}]).roomId,null);
  assert.deepEqual(resolvePreferences('Check availability',history,{view:'any',nightlyBudget:null,breakfastIncluded:false}),{view:'any',nightlyBudget:null,breakfastIncluded:false,roomId:null});
});

test('natural dates, durations and guest counts produce a complete stay',()=>{
  assert.deepEqual(resolveStay('Book a room 5–7 October 2026 for three guests',[],{},now),stay);
  assert.deepEqual(resolveStay('Tomorrow for two nights for my wife and I',[],{},now),{checkIn:'2026-10-02',checkOut:'2026-10-04',adults:2});
  const history=[{role:'user',content:'Find a room 5 October for two nights for 3 guests'}];
  assert.equal(resolveStay('Leaving 8 October',history,{},now).checkOut,'2026-10-08');
  assert.equal(resolveStay('Actually three nights',history,{},now).checkOut,'2026-10-08');
  assert.equal(resolveStay('Book 05/10/2026 for two nights for 2 guests',[],{},now).checkIn,undefined);
  assert.equal(hotelToday(new Date('2026-10-01T23:00:00Z')),'2026-10-02');
});

test('one complete chat request prepares the lowest matching stay and review report',async()=>{
  const result=await answerQuestion({question:'Book a room 5–7 October 2026 for three guests under €400 per night with a terrace and breakfast included'},{now});
  assert.equal(result.bookingPlan.roomId,'terrace');
  assert.equal(result.bookingPlan.autonomous,true);
  assert.deepEqual(result.bookingPlan.stay,stay);
  assert.equal(result.bookingPlan.preferences.breakfastIncluded,true);
  const {quote}=createQuote(result.bookingPlan,now);
  assert.equal(quote.subtotal,780);
  assert.equal(quote.report.categoriesChecked,4);
  assert.equal(quote.report.matchingCategories,1);
  assert.match(quote.report.selectionReason,/Lowest sample/);
  assert.match(quote.report.scope,/No external sites searched/);
});

test('breakfast requirements survive joined preferences and explicit negation',()=>{
  assert.equal(resolvePreferences('Book a room with a terrace and breakfast included').breakfastIncluded,true);
  assert.equal(resolvePreferences('Breakfast must be included').breakfastIncluded,true);
  assert.equal(resolvePreferences("I do not need breakfast included").breakfastIncluded,false);
  assert.equal(resolvePreferences('Is breakfast included?').breakfastIncluded,false);
});

test('missing essentials are collected in chat then lead to an automatic review',async()=>{
  const question='Plan my stay with a terrace under €400 per night';
  const first=await answerQuestion({question},{now});
  assert.deepEqual(first.missing,['checkIn','checkOut','adults']);
  const result=await answerQuestion({question:'5–7 October for three guests',history:[{role:'user',content:question},{role:'assistant',content:first.answer}]},{now});
  assert.equal(result.bookingPlan.roomId,'terrace');
  assert.equal(result.bookingPlan.preferences.nightlyBudget,400);
});

test('a conversational correction updates the stay while a factual follow-up remains a question',async()=>{
  const history=[{role:'user',content:'Book a room with a sea view and breakfast included.'}];
  const result=await answerQuestion({question:'Actually any view is fine and no breakfast needed.',history},{now});
  assert.equal(result.type,'availability-needed');
  assert.equal(result.preferences.view,'any');
  assert.equal(result.preferences.breakfastIncluded,false);
  const factual=await answerQuestion({question:'Is breakfast included?',history},{now});
  assert.equal(factual.type,'answer');
  assert.equal(factual.preferences,undefined);
});

test('review rejects a room that fails the requested budget and preserves explicit room choice',()=>{
  assert.equal(createQuote({roomId:'horizon',stay,preferences:{nightlyBudget:400}},now).status,409);
  assert.match(createQuote({roomId:'terrace',stay,preferences:{roomId:'terrace'}},now).quote.report.selectionReason,/requested this room/);
  assert.equal(createQuote({roomId:'terrace',stay,preferences:{view:'invalid'}},now).status,400);
});

test('Laya is a bounded local preference classifier, never the source of prices or dates',async()=>{
  assert.match(LAYA_ROLE,/not an LLM/);
  const defaults=normalizePreferences();
  const view={choice:'sea',confidence:.7,probabilities:{sea:.94,terrace:.03,unspecified:.03}};
  const breakfast={choice:'included',confidence:.7,probabilities:{included:.94,unspecified:.06}};
  const result=applyClassifierPreferences(defaults,{view,breakfast,nightlyBudget:1},'A coastal outlook and the morning meal covered');
  assert.equal(result.view,'sea');assert.equal(result.breakfastIncluded,true);assert.equal(result.nightlyBudget,null);
  assert.equal(applyClassifierPreferences(defaults,{view:{choice:'sea',confidence:.2248,probabilities:{sea:.6671,terrace:.1164,unspecified:.2164}}},'A coastal outlook').view,'any');
  assert.equal(applyClassifierPreferences(defaults,{view:{choice:'sea',confidence:.22,probabilities:{sea:.51,terrace:.01,unspecified:.48}}},'Unclear outlook').view,'any');
  for(const confidence of [.89,NaN,Infinity,2,'1'])assert.deepEqual(applyClassifierPreferences(defaults,{view:{choice:'sea',confidence}},'A coastal outlook'),defaults);
  assert.equal(applyClassifierPreferences(defaults,{view:{choice:'penthouse',confidence:1,probabilities:{penthouse:1}}},'Upgrade').view,'any');
  assert.equal(applyClassifierPreferences(defaults,{view},'Any view').view,'any');
  assert.equal(applyClassifierPreferences(defaults,{breakfast},"I don't need breakfast").breakfastIncluded,false);
  assert.deepEqual(await classifyPreferences('ocean outlook',[],defaults,{localAiUrl:'http://127.0.0.1:1'}),defaults);
});

test('unsupported preference values are rejected, not coerced',()=>{
  for(const value of [{nightlyBudget:-1},{nightlyBudget:Infinity},{nightlyBudget:'400'},{view:'rooftop pool'},{breakfastIncluded:'false'},null,[]]) assert.throws(()=>normalizePreferences(value));
});

test('no matching preferences returns a useful explanation without breaking availability',async()=>{
  const result=await answerQuestion({question:'Check availability',stay,preferences:{nightlyBudget:100}},{now});
  assert.equal(result.type,'availability');assert.equal(result.availability.rooms.length,0);
  assert.ok(result.availability.compared>0);assert.match(result.answer,/none match all your preferences/);
});

test('booking review recomputes prices and ignores client-supplied totals',()=>{
  const result=createQuote({roomId:'terrace',stay,total:1,basePrice:1,room:{basePrice:1}},now);
  assert.equal(result.ok,true);assert.equal(result.quote.subtotal,780);assert.equal(result.quote.room.basePrice,390);
  assert.equal(result.quote.demo,true);assert.equal(result.quote.paymentEnabled,false);
  assert.equal(result.quote.expiresAt,'2026-10-01T12:15:00.000Z');
  assert.match(result.quote.taxes,/Not supplied/);assert.match(result.quote.notice,/No room is held/);
});

test('booking review rejects invalid room, dates, capacity and sold-out inventory',()=>{
  assert.equal(createQuote({roomId:'penthouse',stay},now).status,400);
  assert.equal(createQuote({roomId:'terrace',stay:{...stay,checkOut:stay.checkIn}},now).status,400);
  assert.equal(createQuote({roomId:'terrace',stay:{...stay,adults:4}},now).status,409);
  let soldOut;
  for(let day=2;day<30&&!soldOut;day++){
    const checkIn=`2026-10-${String(day).padStart(2,'0')}`,checkOut=`2026-10-${String(day+1).padStart(2,'0')}`;
    const candidate={checkIn,checkOut,adults:2};
    const room=hotel.rooms.find(room=>!checkAvailability(validateStay(candidate,now)).rooms.some(item=>item.id===room.id));
    if(room)soldOut={roomId:room.id,stay:candidate};
  }
  assert.ok(soldOut);assert.equal(createQuote(soldOut,now).status,409);
});
