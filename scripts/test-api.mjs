import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:4321';
const results=[];
async function check(name,body,status,verify=()=>{},raw=false){
  const start=Date.now();
  const response=await fetch(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:raw?body:JSON.stringify(body)});
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
const health=await fetch(`${base}/api/health`);assert.equal(health.status,200);
await mkdir('docs/evaluation',{recursive:true});await writeFile('docs/evaluation/api.json',JSON.stringify({date:new Date().toISOString(),base,total:results.length,results},null,2)+'\n');
