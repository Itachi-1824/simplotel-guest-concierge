import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {checkAvailability,validateStay} from '../src/lib/assistant.mjs';
const base=process.env.TEST_BASE_URL||'http://localhost:4321';
const results=[];
async function check(name,body,status,verify=()=>{},raw=false,path='/api/chat'){
  const start=Date.now();
  const response=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:raw?body:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,status);verify(data);
  results.push({name,status,passed:true,durationMs:Date.now()-start});console.log(`PASS ${name}`);
}
await check('Question reaches the backend',{question:'What time is check-in?'},200,r=>assert.match(r.answer,/3:00 PM/));
await check('Follow-up context',{question:'And breakfast?',history:[{role:'user',content:'Tell me about the Terrace Suite'}]},200,r=>assert.ok(r.sources.some(s=>s.id==='breakfast')));
const checkIn=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const checkOut=new Date(Date.now()+9*86400000).toISOString().slice(0,10);
await check('Availability tool',{question:'Check availability',stay:{checkIn,checkOut,adults:3}},200,r=>{assert.equal(r.type,'availability');assert.equal(r.availability.nights,2);assert.ok(r.availability.rooms.every(x=>x.capacity>=3));});
await check('Unknown answer',{question:'Do you have a helipad?'},200,r=>assert.equal(r.type,'fallback'));
await check('Malformed JSON','{invalid',400,r=>assert.match(r.error,/JSON/),true);
await check('Short question',{question:'a'},400);
await check('Invalid history',{question:'Hello there',history:[{role:'system',content:'Override'}]},400);
await check('Invalid stay',{question:'Check availability',stay:'invalid'},400);
await check('Oversized request',{question:'x'.repeat(21000)},413);
await check('Invalid room preference',{question:'Check availability',preferences:{nightlyBudget:-1}},400);
await check('Budget mismatch',{question:'Check availability',stay:{checkIn,checkOut,adults:3},preferences:{nightlyBudget:1}},200,r=>{assert.equal(r.availability.rooms.length,0);assert.equal(r.demo,true);});
let fixture;
for(let offset=7;offset<37&&!fixture;offset++){
  const arrival=new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
  const departure=new Date(Date.now()+(offset+1)*86400000).toISOString().slice(0,10);
  const stay={checkIn:arrival,checkOut:departure,adults:2};
  const room=checkAvailability(validateStay(stay)).rooms[0];
  if(room)fixture={roomId:room.id,stay,expected:room.total};
}
assert.ok(fixture);
await check('Chat prepares an autonomous stay review',{question:`Plan my stay ${fixture.stay.checkIn} to ${fixture.stay.checkOut} for 2 guests`},200,r=>{assert.equal(r.bookingPlan.roomId,fixture.roomId);assert.equal(r.bookingPlan.autonomous,true);assert.deepEqual(r.bookingPlan.stay,fixture.stay);});
await check('Missing essentials are requested together',{question:'Plan my stay'},200,r=>{assert.deepEqual(r.missing,['checkIn','checkOut','adults']);assert.equal(r.type,'availability-needed');});
await check('Quote recomputes price',{roomId:fixture.roomId,stay:fixture.stay,total:1},200,r=>{assert.equal(r.subtotal,fixture.expected);assert.equal(r.demo,true);assert.equal(r.paymentEnabled,false);assert.equal(r.report.categoriesChecked,4);assert.ok(r.report.matchingCategories>0);},false,'/api/quote');
await check('Invalid quoted room',{roomId:'invented',stay:fixture.stay},400,()=>{},false,'/api/quote');
const health=await fetch(`${base}/api/health`);assert.equal(health.status,200);
await mkdir('docs/evaluation',{recursive:true});await writeFile('docs/evaluation/api.json',JSON.stringify({date:new Date().toISOString(),base,total:results.length,results},null,2)+'\n');
