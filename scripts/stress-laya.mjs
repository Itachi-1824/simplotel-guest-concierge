import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolvePreferences,applyClassifierPreferences,CLASSIFIER_POLICY} from '../src/lib/room-preferences.mjs';

if(existsSync('.env'))process.loadEnvFile('.env');
const base=process.env.LOCAL_AI_URL||'http://127.0.0.1:8001';
const output=process.env.LAYA_REPORT_PATH||'docs/evaluation/laya-stress.json';
const cases=JSON.parse(await readFile(new URL('../data/laya-evaluation.json',import.meta.url),'utf8'));
const started=Date.now();
async function request(path,body){
  const start=Date.now();
  const response=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  return {status:response.status,durationMs:Date.now()-start,data:await response.json()};
}
const health=await fetch(`${base}/health`).then(response=>response.json());
if(!health.laya_loaded)throw new Error('Laya must be loaded for this evaluation.');
const preferences=[];
for(const item of cases.preferences){
  const text=[...item.history.map(turn=>turn.content),item.question].join('\n');
  const response=await request('/v1/booking-intent',{question:text});
  const parsed=resolvePreferences(item.question,item.history);
  const effective=applyClassifierPreferences(parsed,response.data,text);
  const raw={view:response.data.view?.choice==='unspecified'?'any':response.data.view?.choice,breakfastIncluded:response.data.breakfast?.choice==='included'};
  const passed=effective.view===item.expected.view&&effective.breakfastIncluded===item.expected.breakfastIncluded;
  preferences.push({...item,...response,parsed,effective,raw,passed});
  if(preferences.length%10===0)console.log(`Preferences ${preferences.length}/${cases.preferences.length}`);
}
const intents=[];
for(const item of cases.intents){
  const response=await request('/v1/analyze',{question:item.question});
  intents.push({...item,...response,passed:response.data.intent===item.expected});
}
console.log(`Intent routes ${intents.filter(item=>item.passed).length}/${intents.length}`);
const queries=[];
for(const item of cases.queries){
  const response=await request('/v1/analyze',item);
  queries.push({...item,...response,selectedCandidate:response.data.selected_query===item.expected,preserved:response.data.selected_query===item.question||response.data.selected_query===item.expected});
}
const validation=[];
for(const question of ['', 'x'.repeat(1601)]){
  const response=await request('/v1/booking-intent',{question});
  validation.push({length:question.length,status:response.status,passed:response.status===422});
}
const load=[];
const loadStart=Date.now();
const loadNonce=Date.now().toString(36);
for(let offset=0;offset<12;offset+=2){
  const batch=await Promise.all(Array.from({length:2},async(_,index)=>{
    const id=offset+index;
    const path=id%2?'/v1/analyze':'/v1/booking-intent';
    const question=id%2?`Is breakfast included in the Terrace Suite? Evaluation case ${loadNonce}-${id}.`:`Book a room with a sea view and breakfast included. Evaluation case ${loadNonce}-${id}.`;
    const response=await request(path,{question});
    return {id,path,status:response.status,durationMs:response.durationMs,passed:response.status===200};
  }));
  load.push(...batch);
  const healthStarted=Date.now();
  const healthResponse=await fetch(`${base}/health`,{signal:AbortSignal.timeout(3000)});
  batch[0].healthDurationMs=Date.now()-healthStarted;
  if(!healthResponse.ok)throw new Error('Stopping the bounded load check: health endpoint unavailable.');
}
const percentile=(values,part)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*part)-1];
const summary={preferences:{effectivePassed:preferences.filter(item=>item.passed).length,total:preferences.length,rawCorrect:preferences.filter(item=>item.raw.view===item.expected.view&&item.raw.breakfastIncluded===item.expected.breakfastIncluded).length,partitions:Object.fromEntries(['dev','holdout'].map(split=>[split,{passed:preferences.filter(item=>item.split===split&&item.passed).length,total:preferences.filter(item=>item.split===split).length}]))},intents:{passed:intents.filter(item=>item.passed).length,total:intents.length},queries:{preserved:queries.filter(item=>item.preserved).length,selectedCandidate:queries.filter(item=>item.selectedCandidate).length,total:queries.length},load:{concurrency:2,total:load.length,passed:load.filter(item=>item.passed).length,p50Ms:percentile(load.map(item=>item.durationMs),.5),p95Ms:percentile(load.map(item=>item.durationMs),.95),durationMs:Date.now()-loadStart},durationMs:Date.now()-started};
await mkdir(output.slice(0,output.lastIndexOf('/')),{recursive:true});
await writeFile(output,JSON.stringify({date:new Date().toISOString(),scope:cases.scope,externalLlm:false,policy:CLASSIFIER_POLICY,health,summary,preferences,intents,queries,validation,load},null,2)+'\n');
console.log(JSON.stringify(summary));
