import {randomInt} from 'node:crypto';

export class ProviderError extends Error {
  constructor(status,kind='http'){
    super(kind==='content_filter'?'Provider content filter rejected the request':`Completion provider ${status}`);
    this.status=status;
    this.kind=kind;
  }
}

export async function requestCompletion(payload,config={}){
  const timeout=Math.min(30000,Math.max(1000,Number(config.modelTimeoutMs)||12000));
  let previousSeed;
  for(let attempt=0;attempt<2;attempt++){
    if(config.canCallModel&&!config.canCallModel())throw new ProviderError(429,'budget');
    let seed=randomInt(0,2147483647);
    if(seed===previousSeed)seed=(seed+1)%2147483647;
    previousSeed=seed;
    let delay=250+randomInt(0,400);
    try{
      const response=await fetch(`${(config.baseUrl||'https://api.openai.com/v1').replace(/\/$/,'')}/chat/completions`,{
        method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(timeout),body:JSON.stringify({...payload,seed})
      });
      if(!response.ok){
        const body=await response.text();
        const blocked=/content[_ -](?:filter|management)|response was filtered/i.test(body);
        const error=new ProviderError(response.status,blocked?'content_filter':'http');
        const retryAfter=response.headers.get('retry-after');
        const requestedDelay=retryAfter===null?0:/^\d+(?:\.\d+)?$/.test(retryAfter)?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-Date.now());
        if(requestedDelay>2000)error.kind='retry_later';
        else if(Number.isFinite(requestedDelay))delay=Math.max(delay,requestedDelay);
        throw error;
      }
      return await response.json();
    }catch(error){
      const transient=error instanceof ProviderError?error.kind==='http'&&[408,429,500,502,503,504].includes(error.status):['TimeoutError','AbortError','TypeError'].includes(error.name);
      if(attempt||!transient)throw error;
      config.logger?.warn?.('Retrying transient completion failure',{status:error.status||null,attempt:2,delayMs:delay});
      await new Promise(resolve=>setTimeout(resolve,delay));
    }
  }
}
