import {writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {answerQuestion} from '../src/lib/assistant.mjs';
import cases from '../data/evaluation-cases.json' with {type:'json'};
const local=process.argv.includes('--local');
const mode=local?'local-models':'baseline';
const config={now:new Date('2026-10-01T12:00:00Z'),trace:true,...(local?{localAiUrl:process.env.LOCAL_AI_URL||'http://127.0.0.1:8001',localTimeoutMs:30000}:{}),logger:{warn(){}}};
const results=[];
for(const item of cases){
  if(item.localOnly&&!local)continue;
  const start=performance.now();
  const result=await answerQuestion(item,config);
  const passed=result.type===item.type&&(!item.source||result.sources.some(source=>source.id===item.source))&&(!item.contains||result.answer.includes(item.contains));
  results.push({id:item.id,passed,durationMs:Math.round(performance.now()-start),type:result.type,sources:result.sources,answer:result.answer,trace:result.trace});
  console.log(`${passed?'PASS':'FAIL'} ${item.id} (${results.at(-1).durationMs} ms)`);
}
const report={date:new Date().toISOString(),mode,clock:'2026-10-01 fixed for repeatable availability',models:local?(await fetch(`${config.localAiUrl}/health`).then(r=>r.json())):null,passed:results.filter(r=>r.passed).length,total:results.length,results};
await mkdir('docs/evaluation',{recursive:true});
await writeFile(`docs/evaluation/${mode}.json`,JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total} passed. Report: docs/evaluation/${mode}.json`);
if(report.passed!==report.total)process.exitCode=1;
