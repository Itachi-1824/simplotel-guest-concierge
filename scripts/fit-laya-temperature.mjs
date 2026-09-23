import {readFile,writeFile} from 'node:fs/promises';

const source=process.argv[2]||'docs/evaluation/laya-stress-before.json';
const report=JSON.parse(await readFile(source,'utf8'));
const scale=(probabilities,temperature)=>{
  const logits=Object.entries(probabilities).map(([key,value])=>[key,Math.log(Math.max(1e-8,value))/temperature]);
  const maximum=Math.max(...logits.map(([,value])=>value));
  const weights=logits.map(([key,value])=>[key,Math.exp(value-maximum)]);
  const total=weights.reduce((sum,[,value])=>sum+value,0);
  return Object.fromEntries(weights.map(([key,value])=>[key,value/total]));
};
function metrics(rows,head,temperature){
  let nll=0,brier=0,correct=0;
  const bins=Array.from({length:10},()=>[]);
  for(const row of rows){
    const probabilities=scale(row.data[head].probabilities,temperature);
    const expected=head==='view'?(row.expected.view==='any'?'unspecified':row.expected.view):(row.expected.breakfastIncluded?'included':'unspecified');
    const [winner,probability]=Object.entries(probabilities).sort((a,b)=>b[1]-a[1])[0];
    const hit=winner===expected?1:0;
    nll-=Math.log(Math.max(1e-8,probabilities[expected]));
    brier+=Object.entries(probabilities).reduce((sum,[key,value])=>sum+(value-(key===expected?1:0))**2,0);
    correct+=hit;bins[Math.min(9,Math.floor(probability*10))].push([probability,hit]);
  }
  return {nll:nll/rows.length,brier:brier/rows.length,ece:bins.reduce((sum,bin)=>sum+Math.abs(bin.reduce((value,[p,hit])=>value+p-hit,0)),0)/rows.length,accuracy:correct/rows.length,count:rows.length};
}
const development=report.preferences.filter(row=>row.split==='dev');
const heldOut=report.preferences.filter(row=>row.split==='holdout');
const heads={};
for(const head of ['view','breakfast']){
  const candidates=Array.from({length:201},(_,index)=>Math.exp(Math.log(.5)+index*(Math.log(5)-Math.log(.5))/200));
  const temperature=candidates.sort((a,b)=>metrics(development,head,a).nll-metrics(development,head,b).nll)[0];
  const before=metrics(heldOut,head,1),after=metrics(heldOut,head,temperature);
  const eligible=after.nll<=before.nll&&after.brier<=before.brier&&after.ece<=before.ece;
  heads[head]={relativeTemperature:temperature,developmentBefore:metrics(development,head,1),developmentAfter:metrics(development,head,temperature),heldOutBefore:before,heldOutAfter:after,eligible};
}
const eligibleHeads=Object.keys(heads).filter(head=>heads[head].eligible);
const result={date:new Date().toISOString(),source,method:'Fit a positive scalar by development-set negative log likelihood on log emitted probabilities. This is an extra temperature on top of the checkpoint temperature, not a raw-logit refit. Check NLL, multiclass Brier sum, and 10-bin ECE on the separate holdout.',scope:`${development.length} development and ${heldOut.length} held-out English cases per head. Exploratory; too small to establish general calibration. No model weights changed.`,applied:false,reason:eligibleHeads.length?`Candidate fits for ${eligibleHeads.join(', ')} need integration checks before promotion.`:'No fit improved all held-out metrics. Keep the existing checkpoint temperatures and the validated application acceptance policy.',heads};
await writeFile('docs/evaluation/laya-temperature.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
