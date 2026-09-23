import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion,hotel} from '../src/lib/assistant.mjs';
import scenarios from '../data/reviewer-scenarios.json' with {type:'json'};

for(const scenario of scenarios.cases)test(`complex fixture: ${scenario.id}`,async()=>{
  const result=await answerQuestion({question:scenario.question},{now:new Date('2026-10-01T12:00:00Z')});
  for(const source of scenario.sources)assert.ok(result.sources.some(item=>item.id===source),`${scenario.id}: missing ${source}; received ${result.sources.map(item=>item.id)}`);
  for(const phrase of scenario.includes)assert.ok(result.answer.toLowerCase().includes(phrase.toLowerCase()),`${scenario.id}: missing ${phrase}`);
});

test('expanded demo fixtures remain unique and explicitly fictional',()=>{
  assert.equal(hotel.demoData.fictional,true);
  assert.equal(hotel.demoData.factCount,42);
  assert.equal(new Set(hotel.facts.map(fact=>fact.id)).size,hotel.facts.length);
  assert.ok(scenarios.cases.every(item=>item.sources.every(id=>hotel.facts.some(fact=>fact.id===id))));
});

test('booking cannot silently claim special-request inventory',async()=>{
  for(const request of ['with a wheelchair accessible room','with my dog','with connecting rooms','with a baby cot','with a gluten-free allergy-safe meal']){
    const result=await answerQuestion({question:`Book a room 5–7 October 2026 for two guests ${request}`},{now:new Date('2026-10-01T12:00:00Z')});
    assert.equal(result.type,'clarification');assert.equal(result.bookingPlan,undefined);assert.match(result.answer,/hotel must confirm/);
  }
});

test('a meal follow-up after booking answers the question without opening another review',async()=>{
  const result=await answerQuestion({question:'Is breakfast included?',history:[{role:'user',content:'Book a room 5–7 October 2026 for three guests'}]});
  assert.equal(result.type,'answer');assert.ok(result.sources.some(item=>item.id==='breakfast'));assert.equal(result.bookingPlan,undefined);
});


test('contact and location answers disclose fictional details and use the shared fixture',async()=>{
  const contact=await answerQuestion({question:'How can I contact the hotel by phone and email?'});
  assert.ok(contact.answer.includes(hotel.hotel.contact.phone));
  assert.ok(contact.answer.includes(hotel.hotel.contact.email));
  assert.match(contact.answer,/non-working demonstration/);
  const location=await answerQuestion({question:'What is the exact hotel address and map location?'});
  assert.ok(location.answer.includes(hotel.hotel.contact.address));
  assert.match(location.answer,/does not identify a real hotel/);
  assert.equal(hotel.hotel.contact.demo,true);
});
