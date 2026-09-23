import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import scenarios from '../data/reviewer-scenarios.json' with {type:'json'};
import {answerQuestion} from '../src/lib/assistant.mjs';

if(existsSync('.env'))process.loadEnvFile('.env');
const local=process.argv.includes('--local');
const config={now:new Date('2026-10-01T12:00:00Z'),trace:true,localAiUrl:local?process.env.LOCAL_AI_URL||'http://127.0.0.1:8001':undefined};
const results=[];
for(const scenario of scenarios.cases){
  const started=Date.now();
  const response=await answerQuestion({question:scenario.question},config);
  const missingSources=scenario.sources.filter(id=>!response.sources.some(source=>source.id===id));
  const missingPhrases=scenario.includes.filter(value=>!response.answer.toLowerCase().includes(value.toLowerCase()));
  const passed=!missingSources.length&&!missingPhrases.length;
  results.push({id:scenario.id,passed,durationMs:Date.now()-started,missingSources,missingPhrases,response});
  console.log(`${passed?'PASS':'FAIL'} ${scenario.id}`);
}
const report={date:new Date().toISOString(),localModels:local,total:results.length,passed:results.filter(item=>item.passed).length,results};
await mkdir('docs/evaluation',{recursive:true});
await writeFile(`docs/evaluation/complex-${local?'local':'baseline'}.json`,JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total} passed`);
if(report.passed!==report.total)process.exitCode=1;
