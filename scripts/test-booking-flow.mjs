import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4327';
const results=[];
const contextOf=result=>({stay:{checkIn:result.availability.checkIn,checkOut:result.availability.checkOut,adults:result.availability.adults},preferences:result.availability.preferences});
async function check(name,body,verify,status=200,path='/api/chat'){
  const started=Date.now();
  const response=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();
  assert.equal(response.status,status,`${name}: ${JSON.stringify(data)}`);
  verify(data);
  results.push({name,passed:true,status,durationMs:Date.now()-started});
  console.log(`PASS ${name}`);
  return data;
}

const first=await check('Exact initial request: dates and two guests',{question:'Can you book a room for 2 from oct 7–12 2026 please'},data=>{
  assert.equal(data.type,'availability');assert.equal(data.availability.adults,2);assert.equal(data.availability.checkIn,'2026-10-07');assert.equal(data.availability.checkOut,'2026-10-12');
});
const revised=await check('Exact shorthand correction',{question:'5–7, two',bookingContext:contextOf(first)},data=>{
  assert.deepEqual(data.bookingPlan.stay,{checkIn:'2026-10-05',checkOut:'2026-10-07',adults:2});assert.equal(data.bookingPlan.roomId,'classic');
});
const bookingContext=contextOf(revised);
await check('Exact guest correction, not a cot question',{question:'need smth only for 2 not 4',bookingContext},data=>{
  assert.equal(data.availability.adults,2);assert.deepEqual(data.sources,[]);assert.equal(data.bookingPlan.roomId,'classic');
});
await check('Single-digit guest reply',{question:'2',bookingContext},data=>assert.equal(data.availability.adults,2));
const breakfast=await check('Breakfast preference update',{question:'Breakfast must be included',bookingContext},data=>{
  assert.equal(data.availability.preferences.breakfastIncluded,true);assert.equal(data.bookingPlan.roomId,'terrace');
});
await check('Remove breakfast requirement',{question:'No breakfast needed',bookingContext:contextOf(breakfast)},data=>{
  assert.equal(data.availability.preferences.breakfastIncluded,false);assert.equal(data.bookingPlan.roomId,'classic');
});
await check('Invalid guest correction stays unbooked',{question:'5 guests',bookingContext},data=>{
  assert.equal(data.type,'availability-needed');assert.equal(data.bookingPlan,undefined);
});
const soldOut=await check('Sold-out dates offer nearby stays',{question:'oct 7–12 2026 3 guests with breakfast included'},data=>{
  assert.equal(data.availability.rooms.length,0);assert.ok(data.availability.alternatives.length);assert.equal(data.bookingPlan,undefined);
});
const alternativeResult=await check('Exact anything-available follow-up',{question:'hmm anything thats available?',bookingContext:contextOf(soldOut)},data=>{
  assert.equal(data.type,'availability');assert.equal(data.availability.adults,3);assert.equal(data.availability.nights,5);assert.deepEqual(data.sources,[]);assert.ok(data.availability.alternatives.length);
});
const option=alternativeResult.availability.alternatives[0];
await check('Alternative dates revalidate in the stay report',{roomId:option.room.id,stay:{checkIn:option.checkIn,checkOut:option.checkOut,adults:option.adults},preferences:alternativeResult.availability.preferences,total:1},data=>{
  assert.equal(data.guests,3);assert.equal(data.nights,5);assert.equal(data.subtotal,option.room.total);assert.equal(data.paymentEnabled,false);assert.equal(data.checkIn,option.checkIn);
},200,'/api/quote');
await check('Parking topic remains a hotel question',{question:'Is parking available?',bookingContext},data=>{
  assert.equal(data.type,'answer');assert.ok(data.sources.some(source=>source.id==='parking'));assert.equal(data.bookingPlan,undefined);
});
await check('Malformed booking context rejected',{question:'anything available?',bookingContext:{stay:{adults:'two'}}},()=>{},400);
await check('Invalid contextual preference rejected',{question:'anything available?',bookingContext:{stay:bookingContext.stay,preferences:{view:'made-up'}}},()=>{},400);

await writeFile('docs/evaluation/booking-flow.json',JSON.stringify({date:new Date().toISOString(),target:base.includes('127.0.0.1')?'local production build':'public HTTPS deployment',total:results.length,results},null,2)+'\n');
