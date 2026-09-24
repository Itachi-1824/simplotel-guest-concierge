export async function readEvents(body,onEvent){
  if(!body)throw new Error('Response stream is unavailable');
  const reader=body.getReader();
  const decoder=new TextDecoder();
  let buffer='';
  const process=()=>{
    let match;
    while((match=/\r?\n\r?\n/.exec(buffer))){
      const block=buffer.slice(0,match.index);
      buffer=buffer.slice(match.index+match[0].length);
      const data=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if(!data||data==='[DONE]')continue;
      onEvent(JSON.parse(data));
    }
  };
  try{
    while(true){
      const {done,value}=await reader.read();
      buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
      process();
      if(done){if(buffer.trim()){buffer+='\n\n';process();}break;}
    }
  }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
}

export function partialAnswer(content){
  const match=/"answer"\s*:\s*"/.exec(content);
  if(!match)return '';
  const start=match.index+match[0].length;
  let output='';
  for(let i=start;i<content.length;i++){
    const char=content[i];
    if(char==='"')break;
    if(char!=='\\'){output+=char;continue;}
    const next=content[++i];
    if(!next)break;
    if(next==='u'){
      const hex=content.slice(i+1,i+5);
      if(!/^[\da-f]{4}$/i.test(hex))break;
      output+=String.fromCharCode(parseInt(hex,16));i+=4;
    }else if(Object.hasOwn({n:1,r:1,t:1,b:1,f:1,'"':1,'\\':1,'/':1},next)){
      output+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','"':'"','\\':'\\','/':'/'})[next];
    }else break;
  }
  if(/[\uD800-\uDBFF]$/.test(output))output=output.slice(0,-1);
  return output;
}

export async function collectCompletionStream(body,onContent){
  const message={role:'assistant',content:''};
  const calls=new Map();
  let finishReason=null;
  let usage;
  await readEvents(body,event=>{
    if(event.error)throw new Error('Provider stream reported an error');
    if(event.usage)usage=event.usage;
    const choice=event.choices?.[0];
    if(!choice)return;
    if(choice.finish_reason)finishReason=choice.finish_reason;
    const delta=choice.delta||{};
    if(typeof delta.content==='string'){
      message.content+=delta.content;
      onContent?.(message.content);
    }
    for(const part of delta.tool_calls||[]){
      const index=part.index??0;
      const call=calls.get(index)||{id:'',type:'function',function:{name:'',arguments:''}};
      if(part.id)call.id=part.id;
      if(part.type)call.type=part.type;
      if(part.function?.name)call.function.name+=part.function.name;
      if(part.function?.arguments)call.function.arguments+=part.function.arguments;
      calls.set(index,call);
    }
  });
  if(!finishReason)throw new Error('Provider stream ended before completion');
  if(calls.size)message.tool_calls=[...calls.entries()].sort((a,b)=>a[0]-b[0]).map(([,call])=>call);
  return {choices:[{message,finish_reason:finishReason}],usage};
}

export function visibleReply(content){
  let text=content.replace(/^\s*<(?:think|thinking)>[\s\S]*?<\/(?:think|thinking)>\s*/i,'');
  if(/^\s*<(?:think|thinking)>/i.test(text))return '';
  if(/^\s*<[^>]*$/.test(text))return '';
  return text;
}
