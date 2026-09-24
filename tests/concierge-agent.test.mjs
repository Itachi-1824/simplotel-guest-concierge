import test from 'node:test';
import assert from 'node:assert/strict';
import {runConciergeAgent} from '../src/lib/concierge-agent.mjs';
import {requestCompletion} from '../src/lib/llm-request.mjs';
const context={question:'What about dogs and breakfast?',activeStay:{checkIn:'2026-10-05',checkOut:'2026-10-07',adults:2},preferences:{view:'any'},recentConversation:[],hotelTopics:[]};
const config={apiKey:'test',model:'glm',fallbackModel:'luna'};
const call=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const tool=(...calls)=>({choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:calls}}]});
const final=(answer,ids=[],kind=ids.length?'hotel_answer':'conversation')=>({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({kind,answer,sourceIds:ids})}}]});
const fact=id=>({id,topic:id,answer:'Fixture '+id});
const original=globalThis.fetch;
async function mocked(responses,body){
 const payloads=[];
 globalThis.fetch=async(url,options)=>{
  const payload=JSON.parse(options.body);payloads.push(payload);
  const response=responses.shift();
  if(response instanceof Error)throw response;
  if(typeof response==='function')return response(payload);
  if(response instanceof Response)return response;
  if(!response)throw new Error('Unexpected provider call');
  return Response.json(response);
 };
 try{return await body(payloads);}finally{globalThis.fetch=original;}
}
await test('small talk needs zero tools and preserves conversation context',async()=>{
 await mocked([final('Aw, I get it 🙂')],async payloads=>{
  const result=await runConciergeAgent({...context,recentConversation:[{role:'user',content:'I wanted that room'}]},config,{search:()=>assert.fail(),prepare:()=>assert.fail()});
  assert.match(result.answer,/get it/);assert.equal(result.availability,undefined);
  assert.equal(JSON.parse(payloads[0].messages[1].content).recentConversation[0].content,'I wanted that room');
 });
});
await test('generic OpenAI setup uses a default model without provider-specific reasoning options',async()=>{
 await mocked([final('Hello')],async payloads=>{
  const result=await runConciergeAgent(context,{apiKey:'test'},{search:()=>assert.fail(),prepare:()=>assert.fail()});
  assert.equal(result.answer,'Hello');
  assert.equal(payloads[0].model,'gpt-4.1-mini');
  assert.equal(payloads[0].reasoning_effort,undefined);
 });
});
await test('independent search tools overlap in one model turn',async()=>{
 let pending=[];let searches=0;
 await mocked([tool(call('a','search_hotel_information',{query:'dogs',topicIds:['pets']}),call('b','search_hotel_information',{query:'breakfast',topicIds:['breakfast']})),final('Dogs and breakfast explained',['pets','breakfast'])],async payloads=>{
  const result=await runConciergeAgent(context,config,{search:parsed=>new Promise(resolve=>{searches++;pending.push(()=>resolve({facts:[fact(parsed.topicIds[0])]}));if(pending.length===2)pending.forEach(fn=>fn());})});
  assert.equal(searches,2);assert.equal(result.sources.length,2);
  assert.equal(payloads.length,2);assert.equal(payloads[0].parallel_tool_calls,true);assert.equal(payloads[0].max_tokens,undefined);
  assert.equal(payloads[1].messages.filter(message=>message.role==='tool').length,2);
 });
});
await test('identical concurrent searches share one retrieval',async()=>{
 let searches=0;
 await mocked([tool(call('a','search_hotel_information',{query:'dogs',topicIds:['pets']}),call('b','search_hotel_information',{topicIds:['pets'],query:'dogs'})),final('Dogs explained',['pets'])],async()=>{
  await runConciergeAgent(context,config,{search:async()=>{searches++;return {facts:[fact('pets')]};}});
  assert.equal(searches,1);
 });
});
await test('agent can inspect results and perform a second search',async()=>{
 let searches=0;
 await mocked([tool(call('a','search_hotel_information',{query:'pets'})),tool(call('b','search_hotel_information',{query:'breakfast'})),final('Both explained',['pets','breakfast'])],async payloads=>{
  const result=await runConciergeAgent(context,config,{search:async()=>({facts:[fact(searches++?'breakfast':'pets')]})});
  assert.equal(searches,2);assert.equal(payloads.length,3);assert.equal(result.sources.length,2);
 });
});
await test('twenty five call ceiling spans batches; extra calls are not executed',async()=>{
 let searches=0;
 const first=Array.from({length:24},(_,i)=>call('t'+i,'search_hotel_information',{query:'query'+i}));
 await mocked([tool(...first),tool(call('next','search_hotel_information',{query:'last'}),call('excess','search_hotel_information',{query:'not allowed'})),final('Supported answer',['pets'])],async payloads=>{
  await runConciergeAgent(context,config,{search:async()=>{searches++;return {facts:[fact('pets')]};}});
  assert.equal(searches,25);
  assert.equal(payloads[2].tools,undefined);
  assert.match(payloads[2].messages.find(message=>message.tool_call_id==='excess').content,/not executed/);
 });
});
await test('stay changes in a batch run sequentially with updated context',async()=>{
 const states=[];
 await mocked([tool(call('a','prepare_stay',{adults:3}),call('b','prepare_stay',{checkOut:'2026-10-08'})),final('Stay updated',[],'hotel_answer')],async()=>{
  const result=await runConciergeAgent(context,config,{prepare:async(parsed,active)=>{
   states.push(structuredClone(active.activeStay));
   return {type:'availability',stay:{...active.activeStay,...parsed.stay},preferences:active.preferences,sources:[]};
  }});
  assert.equal(states[1].adults,3);
  assert.equal(result.stay.adults,3);
  assert.equal(result.stay.checkOut,'2026-10-08');
 });
});
await test('transient GLM failure switches to Luna and stays there for this answer',async()=>{
 await mocked([new DOMException('timeout','TimeoutError'),tool(call('a','search_hotel_information',{query:'dogs'})),final('Dogs explained',['pets'])],async payloads=>{
  const result=await runConciergeAgent(context,config,{search:async()=>({facts:[fact('pets')]})});
  assert.deepEqual(payloads.map(item=>item.model),['glm','luna','luna']);
  assert.notEqual(payloads[0].seed,payloads[1].seed);
  assert.equal(result.sources[0].id,'pets');
 });
});
await test('invalid tool output retries with Luna before executing anything',async()=>{
 let searches=0;
 await mocked([tool(call('a','delete_everything',{})),final('Hello 🙂')],async payloads=>{
  await runConciergeAgent(context,config,{search:()=>searches++});
  assert.equal(searches,0);assert.deepEqual(payloads.map(item=>item.model),['glm','luna']);
 });
});
await test('unknown sources are rejected and known evidence remains available',async()=>{
 await mocked([tool(call('a','search_hotel_information',{query:'dogs'})),final('Made up',['invented']),final('Dogs explained',['pets'])],async()=>{
  const result=await runConciergeAgent(context,config,{search:async()=>({facts:[fact('pets')]})});
  assert.equal(result.answer,'Dogs explained');
 });
});
await test('provider content filtering does not trigger model fallback',async()=>{
 await mocked([new Response('content_filter',{status:422})],async payloads=>{
  await assert.rejects(requestCompletion({model:'glm'},config),error=>error.kind==='content_filter');
  assert.equal(payloads.length,1);
 });
});

import {collectCompletionStream,partialAnswer,readEvents} from '../src/lib/chat-stream.mjs';
import {MODEL_LIMITS,validateModelInput} from '../src/lib/model-limits.mjs';
function eventBody(events){
 const bytes=new TextEncoder().encode(events.map(event=>'data: '+(typeof event==='string'?event:JSON.stringify(event))+'\r\n\r\n').join(''));
 return new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));controller.close();}});
}
await test('streamed UTF-8 and JSON string escapes render without raw JSON',async()=>{
 const chunks=['{"kind":"conversation","ans','wer":"Hello \\uD83D','\\uDE0A\\n','welcome!","sourceIds":[]}'];
 const text=[];
 const data=await collectCompletionStream(eventBody([...chunks.map(content=>({choices:[{delta:{content}}]})),{choices:[{delta:{},finish_reason:'stop'}]},'[DONE]']),content=>text.push(partialAnswer(content)));
 assert.equal(text.at(-1),'Hello 😊\nwelcome!');
 assert.equal(data.choices[0].finish_reason,'stop');
 assert.equal(text.some(value=>value.includes('sourceIds')),false);
});
await test('stream reconstructs multiple interleaved tool calls',async()=>{
 const data=await collectCompletionStream(eventBody([
 {choices:[{delta:{tool_calls:[{index:0,id:'a',type:'function',function:{name:'search_hotel_information',arguments:'{"query":"'}},{index:1,id:'b',type:'function',function:{name:'prepare_stay',arguments:'{"adults":'}}]}}]},
 {choices:[{delta:{tool_calls:[{index:1,function:{arguments:'3}'}},{index:0,function:{arguments:'dinner"}'}}]},finish_reason:'tool_calls'}]},
 '[DONE]']));
 assert.equal(data.choices[0].message.tool_calls.length,2);
 assert.equal(JSON.parse(data.choices[0].message.tool_calls[0].function.arguments).query,'dinner');
 assert.equal(JSON.parse(data.choices[0].message.tool_calls[1].function.arguments).adults,3);
});
await test('interrupted provider stream cannot become a finished answer',async()=>{
 await assert.rejects(collectCompletionStream(eventBody([{choices:[{delta:{content:'partial'}}]}])),/before completion/);
});
await test('application stream keeps status, incremental text, then canonical result',async()=>{
 const types=[];
 await readEvents(eventBody([{type:'status',text:'Checking…'},{type:'text',text:'Dinner'},{type:'text',text:'Dinner 🍝'},{type:'result',result:{answer:'Dinner 🍝'}}]),event=>types.push(event.type));
 assert.deepEqual(types,['status','text','text','result']);
});
await test('model-specific conservative budgets reject oversized input before API calls',()=>{
 assert.equal(MODEL_LIMITS['z-ai/glm-5.3-flash'].context,1048576);
 assert.equal(MODEL_LIMITS['openai/gpt-5.6-luna'].maxOutput,128000);
 for(const model of Object.keys(MODEL_LIMITS)){
  validateModelInput({messages:[{role:'user',content:'Dinner?'}]},model);
  assert.throws(()=>validateModelInput({messages:[{role:'user',content:'x'.repeat(1100000)}]},model),/input budget/);
 }
});
await test('an aborted guest request does not spend on a fallback',async()=>{
 const controller=new AbortController();controller.abort();
 await mocked([],async payloads=>{
  await assert.rejects(requestCompletion({model:'glm'},{...config,signal:controller.signal}),error=>error.name==='AbortError');
  assert.equal(payloads.length,0);
 });
});

await test('ordinary final text is streamed and accepted without a JSON wrapper',async()=>{
 await mocked([tool(call('a','search_hotel_information',{query:'dogs'})),{choices:[{finish_reason:'stop',message:{role:'assistant',content:'Dogs are welcome in selected rooms'}}]}],async payloads=>{
  const result=await runConciergeAgent(context,config,{search:async()=>({facts:[fact('pets')]})});
  assert.equal(result.answer,'Dogs are welcome in selected rooms');
  assert.equal(result.sources[0].id,'pets');
  assert.equal(payloads[0].response_format,undefined);
  assert.equal(payloads[0].stream,true);
 });
});
