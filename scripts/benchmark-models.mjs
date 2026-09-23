import {writeFile, mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {hotel, modelSynthesis} from '../src/lib/assistant.mjs';

if (!process.env.OPENAI_API_KEY) throw new Error('Load a provider key through the environment or Node --env-file.');
const models = ['nvidia/nemotron-3.5-lightning','openai/gpt-5.4-nano','mistralai/mistral-large-3','openai/gpt-5-nano','openai/gpt-5.6-luna'];
const cases = [
  {id:'parking-cancellation',question:'How much does valet parking cost, and when can I cancel a flexible reservation without charge?',sources:['parking','cancellation'],required:['€28','48 hours','6:00 PM']},
  {id:'breakfast-pool',question:'Is breakfast included in the Classic Room, and what time does the pool close?',sources:['breakfast','pool'],required:['Classic Room','€24','8:00 PM']},
  {id:'terrace-wifi',question:'How many guests can the Terrace Suite hold, and is Wi-Fi free?',sources:['terrace','wifi'],required:['3 guests','Complimentary Wi-Fi']}
];
const config = {apiKey:process.env.OPENAI_API_KEY,baseUrl:process.env.OPENAI_BASE_URL||'https://gen.pollinations.ai/v1',modelMaxTokens:1200,modelTimeoutMs:20000};
const results=[];
for (const item of cases) {
  const pending=[...models];
  await Promise.all(Array.from({length:3},async()=>{
    while(pending.length){
      const model=pending.shift();
      const start=performance.now();
      let answer, error;
      try { answer=await modelSynthesis(item.question,item.sources.map(id=>hotel.facts.find(fact=>fact.id===id)),{...config,model}); }
      catch(cause) { error=cause.message; }
      const durationMs=Math.round(performance.now()-start);
      const missing=item.required.filter(value=>!answer?.includes(value));
      const passed=!error && !missing.length;
      results.push({model,case:item.id,passed,durationMs,...(error?{error}:{}),...(answer?{answer}:{}),...(missing.length?{missing}: {})});
      console.log(JSON.stringify({model,case:item.id,passed,durationMs,...(error?{error}:{})}));
    }
  }));
}
const summaries=models.map(model=>{
  const rows=results.filter(result=>result.model===model);
  const times=rows.map(row=>row.durationMs).sort((a,b)=>a-b);
  return {model,passed:rows.filter(row=>row.passed).length,total:rows.length,medianMs:times[1],maxMs:times.at(-1)};
}).sort((a,b)=>b.passed-a.passed||a.medianMs-b.medianMs);
const report={date:new Date().toISOString(),provider:'Pollinations',method:'Three identical hotel evidence-selection tasks per model, up to three concurrent requests. Validated source IDs, complete sentences, and required facts. Small sample; not a general model ranking.',maxTokens:config.modelMaxTokens,timeoutMs:config.modelTimeoutMs,selected:summaries.find(item=>item.passed===cases.length)?.model||null,summaries,results};
await mkdir('docs/evaluation',{recursive:true});
await writeFile('docs/evaluation/provider-models.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({selected:report.selected,summaries},null,2));
