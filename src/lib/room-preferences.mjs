export function normalizePreferences(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Room preferences must be an object.');
  const {nightlyBudget=null, view='any', breakfastIncluded=false,roomId=null}=input;
  if (nightlyBudget!==null && (typeof nightlyBudget!=='number' || !Number.isFinite(nightlyBudget) || nightlyBudget<1 || nightlyBudget>10000)) throw new Error('Choose a nightly budget between €1 and €10,000.');
  if (!['any','sea','terrace'].includes(view)) throw new Error('Choose any view, a sea view, or a terrace.');
  if (typeof breakfastIncluded!=='boolean') throw new Error('Breakfast preference must be true or false.');
  if(roomId!==null&&!['classic','sea-view','terrace','horizon'].includes(roomId))throw new Error('Choose a valid room category.');
  return {nightlyBudget,view,breakfastIncluded,roomId};
}

function preferenceClauses(text) {
  return text.split(/(?<=[.!?;])\s+|\n+/).map(value=>value.trim()).filter(value=>value
    && !/^(?:tell me|what|which|how|does|is|are|do the|do your)\b/i.test(value)
    && !/\b(?:system:|classifier instructions|output (?:sea|included)|ignore .*instructions)\b/i.test(value))
    .map(value=>value.replace(/\b(?:and )?tell me (?:if|whether|about)\b.*$/i,''));
}

function preferenceOverrides(text) {
  const result={};
  for(const value of preferenceClauses(text)){
    const noView=/\b(?:any view|no (?:room )?view preference|view (?:does not|doesn't) matter|(?:don't|do not) (?:need|want) (?:a |an )?(?:sea|ocean)[ -]view|without (?:a |an )?(?:(?:sea|ocean)[ -]view|terrace)|(?:a )?terrace is not (?:necessary|needed|required))\b/i.test(value);
    if(noView)result.view='any';
    else if(/\b(?:(?:sea|ocean)[ -](?:view|outlook)|(?:overlooking|facing|looking at) (?:the )?(?:sea|ocean))\b/i.test(value))result.view='sea';
    else if(/\b(?:(?:with|prefer|want|need|book|to) (?:a |private |outdoor )*terrace|private (?:outdoor )?terrace)\b/i.test(value))result.view='terrace';
    if(/\b(?:breakfast (?:included|must be included)|include breakfast)\b/i.test(value))result.breakfastIncluded=true;
    if(/\b(?:(?:without|no|skip|remove|no need for|don't need|do not need) (?:included )?breakfast|breakfast (?:is )?(?:optional|not (?:needed|required))|pay separately for breakfast)\b/i.test(value))result.breakfastIncluded=false;
  }
  return result;
}

export function hasPreferenceUpdate(text) {
  return Object.keys(preferenceOverrides(text)).length>0;
}

export function resolvePreferences(question, history=[], input, contextPreferences) {
  if (input!==undefined) return normalizePreferences(input);
  const result=contextPreferences?normalizePreferences(contextPreferences):{};
  const recent=contextPreferences?[]:history.filter(turn=>turn.role==='user').slice(-4).map(turn=>turn.content);
  for(const text of [...recent,question]){
    if(/^(?:tell me|what|which|how|does|is|are)\b/i.test(text.trim())&&!/\b(?:availab\w*|book\w*|reserv\w*)\b/i.test(text))continue;
    const budget=text.match(/\b(?:under|up to|maximum|max|budget(?: of)?)\s*(?:€|EUR\s*)(\d+(?:\.\d{1,2})?)\s*(?:per\s*night|\/\s*night|a\s*night)/i);
    if(budget) result.nightlyBudget=Number(budget[1]);
    const namedRoom=[['classic',/classic room/i],['sea-view',/sea[ -]view room/i],['terrace',/terrace suite/i],['horizon',/horizon suite/i]].find(([,pattern])=>pattern.test(text));
    if(namedRoom)result.roomId=namedRoom[0];
    if(/\b(?:any room|cheapest room|any category)\b/i.test(text))result.roomId=null;
    Object.assign(result,preferenceOverrides(text));
  }
  return normalizePreferences(result);
}

export function matchRooms(rooms, preferences) {
  return rooms.filter(room=>(preferences.nightlyBudget===null || room.basePrice<=preferences.nightlyBudget)
    && (preferences.view==='any' || preferences.view==='sea' && room.view==='Sea view' || preferences.view==='terrace' && room.terrace)
    && (!preferences.breakfastIncluded || room.breakfastIncluded)
    && (!preferences.roomId || room.id===preferences.roomId)).sort((a,b)=>a.basePrice-b.basePrice);
}

export const LAYA_ROLE='Local classifier, not an LLM';
export const CLASSIFIER_POLICY=Object.freeze({minimumConfidence:.1,minimumWinner:.9,minimumMargin:.3});

export function applyClassifierPreferences(preferences, decisions, text) {
  const result={...preferences};
  const explicit=preferenceOverrides(text);
  const context=preferenceClauses(text).join(' ');
  const confident=decision=>{
    if(!decision||!Number.isFinite(decision.confidence)||decision.confidence<CLASSIFIER_POLICY.minimumConfidence||decision.confidence>1)return false;
    const scores=decision.probabilities;
    if(!scores||Object.values(scores).some(value=>!Number.isFinite(value)||value<0||value>1))return false;
    const selected=scores[decision.choice],others=Object.entries(scores).filter(([key])=>key!==decision.choice).map(([,value])=>value);
    return others.length>0&&Math.abs(Object.values(scores).reduce((sum,value)=>sum+value,0)-1)<.01&&selected>=CLASSIFIER_POLICY.minimumWinner&&selected-Math.max(...others)>=CLASSIFIER_POLICY.minimumMargin;
  };
  const view=decisions?.view;
  const breakfast=decisions?.breakfast;
  const viewMention=view?.choice==='sea'?/\b(?:ocean|sea|coast|outlook)\b/i.test(context):/\b(?:terrace|outdoor)\b/i.test(context);
  if(explicit.view===undefined&&confident(view)&&['sea','terrace'].includes(view.choice)&&preferences.view==='any'&&viewMention)result.view=view.choice;
  if(explicit.breakfastIncluded===undefined&&confident(breakfast)&&breakfast.choice==='included'&&/\b(?:breakfast|morning meal)\b/i.test(context))result.breakfastIncluded=true;
  Object.assign(result,explicit);
  return normalizePreferences(result);
}

export async function classifyPreferences(question,history,preferences,config={}) {
  if(!config.localAiUrl)return preferences;
  const text=[...history.filter(turn=>turn.role==='user').slice(-3).map(turn=>turn.content).filter(value=>! /^(?:tell me|what|which|how|does|is|are)\b/i.test(value.trim())),question].join('\n').slice(-1600);
  try{
    const response=await fetch(`${config.localAiUrl.replace(/\/$/,'')}/v1/booking-intent`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text}),signal:AbortSignal.timeout(3500)});
    if(!response.ok)return preferences;
    return applyClassifierPreferences(preferences,await response.json(),text);
  }catch{return preferences;}
}
