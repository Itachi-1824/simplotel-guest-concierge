export const MODEL_LIMITS=Object.freeze({
  'z-ai/glm-5.3-flash':{context:1048576,maxOutput:null},
  'openai/gpt-5.6-luna':{context:1050000,maxOutput:128000}
});
export function validateModelInput(payload,model){
  const limits=MODEL_LIMITS[model];
  if(!limits)return;
  const conservativeInput=Buffer.byteLength(JSON.stringify({messages:payload.messages,tools:payload.tools}),'utf8')+4096;
  const reserve=limits.maxOutput||Math.ceil(limits.context/2);
  if(conservativeInput+reserve>limits.context)throw new Error('Conversation exceeds the safe model input budget');
}
