import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion,hotel,evidenceSentences,retrieve} from '../src/lib/assistant.mjs';
import {planQuery,resolveStay} from '../src/lib/query-plan.mjs';
import {autoTitle,createSession,loadSavedSessions,exportTranscript} from '../src/lib/sessions.mjs';
import graph from '../data/knowledge-graph.json' with {type:'json'};
const config={now:new Date('2026-10-01'),trace:true,logger:{warn(){}}};

test('amenity availability never invokes room inventory',async()=>{
  const answer=await answerQuestion({question:'Is parking available?'},config);
  assert.equal(answer.type,'answer'); assert.match(answer.answer,/28/); assert.equal(answer.sources[0].id,'parking');
});
test('single-topic answers do not append unrelated policies',async()=>{
  const answer=await answerQuestion({question:'What time is check-in?'},config);
  assert.deepEqual(answer.sources.map(x=>x.id),['arrival']);
});
test('named room answers stay focused on that room',async()=>{
  const answer=await answerQuestion({question:'Tell me about the Terrace Suite'},config);
  assert.deepEqual(answer.sources.map(x=>x.id),['terrace']);
});
test('unsupported indoor-pool assumption is corrected',async()=>{
  const answer=await answerQuestion({question:'Is the indoor pool open?'},config);
  assert.match(answer.answer,/does not confirm an indoor pool/);
});
test('ambiguous question requests clarification',async()=>{
  assert.equal((await answerQuestion({question:'Is it included?'},config)).type,'clarification');
});
test('follow-up resolves the room entity and graph policy',async()=>{
  const plan=planQuery('And breakfast?',[{role:'user',content:'Tell me about the Terrace Suite'}]);
  assert.deepEqual(plan.entities,['terrace']);
  const facts=await retrieve(plan.query,config,null,plan);
  assert.equal(facts.find(x=>x.id==='breakfast').graph.relation,'meal_policy');
});
test('availability collects details across multiple turns',async()=>{
  const history=[{role:'user',content:'Check room availability for 3 guests'},{role:'user',content:'2026-10-05 to 2026-10-07'}];
  assert.deepEqual(resolveStay('And for two guests?',history),{checkIn:'2026-10-05',checkOut:'2026-10-07',adults:2});
  assert.equal((await answerQuestion({question:'And for two guests?',history},config)).type,'availability');
});
test('every graph edge has valid source evidence',()=>{
  const ids=new Set(hotel.facts.map(x=>x.id));
  for(const edge of graph.edges){assert.ok(ids.has(edge.from)&&ids.has(edge.to));assert.ok(edge.evidence.length);assert.ok(edge.evidence.every(id=>ids.has(id)));}
});
test('LLM can only select verbatim sentences from supplied sources',async()=>{
  const original=global.fetch;
  global.fetch=async(url,init)=>{
    assert.equal(url,'https://example.test/v1/chat/completions');
    const payload=JSON.parse(init.body); const evidence=JSON.parse(payload.messages[1].content).evidence;
    assert.ok(evidence.length>=2);
    return Response.json({choices:[{message:{content:JSON.stringify({selections:evidence.map(f=>({sourceId:f.id,sentences:[0]}))})}}]});
  };
  try{
    const answer=await answerQuestion({question:'Tell me about breakfast and parking'},{...config,apiKey:'test-only',baseUrl:'https://example.test/v1'});
    assert.equal(answer.trace.mode,'llm-extractive');
    for(const paragraph of answer.answer.split('\n\n')) assert.ok(hotel.facts.some(f=>evidenceSentences(f.answer).includes(paragraph)));
  } finally {global.fetch=original;}
});
for(const failure of ['offline','invented-source','invalid-index']) test(`LLM ${failure} falls back to complete grounded facts`,async()=>{
  const original=global.fetch;
  global.fetch=async()=>{
    if(failure==='offline') throw new Error('offline');
    const selections=failure==='invented-source'?[{sourceId:'invented',sentences:[0]}]:[{sourceId:'breakfast',sentences:[999]},{sourceId:'parking',sentences:[0]}];
    return Response.json({choices:[{message:{content:JSON.stringify({selections})}}]});
  };
  try{
    const answer=await answerQuestion({question:'Tell me about breakfast and parking'},{...config,apiKey:'test-only'});
    assert.equal(answer.trace.mode,'grounded-extractive');assert.match(answer.answer,/24/);assert.match(answer.answer,/28/);
  } finally{global.fetch=original;}
});
test('corrupt saved state resets safely; missing folder becomes unfiled',()=>{
  const welcome={id:0,role:'assistant',content:'Welcome'};
  assert.equal(loadSavedSessions('{broken',welcome),null);
  const saved=createSession(welcome,'test');saved.folderId='deleted';
  const loaded=loadSavedSessions(JSON.stringify({sessions:[saved],folders:[]}),welcome);
  assert.equal(loaded.sessions[0].folderId,null);assert.equal(loaded.activeId,'test');
  assert.ok(autoTitle('a'.repeat(100)).length<=38);
});
test('transcript export includes availability cards and their totals',()=>{
  const text=exportTranscript({title:'Italy trip',messages:[{role:'assistant',content:'One room found.',availability:{checkIn:'2026-10-05',checkOut:'2026-10-07',adults:3,nights:2,rooms:[{name:'Terrace Suite',total:780,basePrice:390,capacity:3,available:1}]}}]});
  assert.match(text,/Terrace Suite: €780 total/);assert.match(text,/2026-10-05 to 2026-10-07/);assert.match(text,/No reservation is made/);
});
