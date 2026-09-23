import {readFile,writeFile} from 'node:fs/promises';

const report=JSON.parse(await readFile(process.argv[2]||'docs/evaluation/laya-stress-before.json','utf8'));
const development=report.preferences.filter(item=>item.split==='dev');
const candidates=[];
for(const minWinner of [.65,.7,.75,.8,.85,.9,.95]){
  let correct=0,incorrect=0,abstained=0;
  for(const item of development)for(const [head,positive] of [['view',['sea','terrace']],['breakfast',['included']]]){
    const decision=item.data[head];
    if(!positive.includes(decision?.choice))continue;
    const scores=decision.probabilities||{};
    const score=scores[decision.choice]||0;
    const margin=score-Math.max(...Object.entries(scores).filter(([key])=>key!==decision.choice).map(([,value])=>value));
    if(decision.confidence<.1||score<minWinner||margin<.3){abstained++;continue;}
    const expected=head==='view'?item.expected.view:item.expected.breakfastIncluded?'included':'unspecified';
    if(decision.choice===expected)correct++;else incorrect++;
  }
  candidates.push({minWinner,correct,incorrect,abstained});
}
const selected=candidates.filter(item=>!item.incorrect&&item.correct>0).sort((a,b)=>b.correct-a.correct||a.minWinner-b.minWinner)[0];
const result={date:new Date().toISOString(),scope:'Decision-threshold selection on 20 development cases only. Model weights and temperatures unchanged. Scores are not calibrated probabilities.',minimumConfidence:.1,minimumMargin:.3,candidates,selected};
await writeFile('docs/evaluation/laya-calibration.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
