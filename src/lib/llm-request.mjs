import {collectCompletionStream} from './chat-stream.mjs';
import {validateModelInput} from './model-limits.mjs';
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
  const backup=config.fallbackModel&&config.fallbackModel!==payload.model?config.fallbackModel:null;
  let previousSeed;
  for(let attempt=0;attempt<2;attempt++){
    if(config.canCallModel&&!config.canCallModel())throw new ProviderError(429,'budget');
    const model=attempt&&backup?backup:payload.model;
    validateModelInput(payload,model);
    config.signal?.throwIfAborted();
    config.onAttempt?.(model,attempt);
    const started=Date.now();
    let seed=randomInt(0,2147483647);
    if(seed===previousSeed)seed=(seed+1)%2147483647;
    previousSeed=seed;
    let delay=250+randomInt(0,400);
    try{
      const response=await fetch(`${(config.baseUrl||'https://api.openai.com/v1').replace(/\/$/,'')}/chat/completions`,{
        method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},
        signal:config.signal?AbortSignal.any([config.signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),body:JSON.stringify({...payload,model,seed})
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
      let data;
      try{
        data=(response.headers.get('content-type')||'').includes('text/event-stream')?await collectCompletionStream(response.body,config.onContent):await response.json();
        config.validateResponse?.(data);
      }catch(error){if(['TimeoutError','AbortError'].includes(error.name))throw error;config.logger?.warn?.('completion_validation_failed',{model,reason:error.message});if(!backup)throw error;throw new ProviderError(502,'invalid_output');}
      config.logger?.info?.('llm_completion',{model,attempt:attempt+1,durationMs:Date.now()-started});
      config.onModelUsed?.(model);
      return data;
    }catch(error){
      if(config.signal?.aborted)throw error;
      const transient=error instanceof ProviderError?error.kind==='http'&&[408,429,500,502,503,504].includes(error.status):['TimeoutError','AbortError','TypeError'].includes(error.name);
      const backupEligible=backup&&error instanceof ProviderError&&(error.kind==='invalid_output'||error.kind==='http'&&[400,404,422].includes(error.status));
      if(attempt||!transient&&!backupEligible)throw error;
      config.logger?.warn?.('Retrying transient completion failure',{status:error.status||null,reason:error.kind||error.name,fromModel:model,toModel:backup||model,attempt:2,delayMs:delay});
      await new Promise(resolve=>setTimeout(resolve,delay));
    }
  }
}
