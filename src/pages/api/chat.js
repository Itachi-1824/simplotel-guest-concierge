import { answerQuestion } from '../../lib/assistant.mjs';
import { createRequestLimits } from '../../lib/request-limits.mjs';
import {normalizePreferences} from '../../lib/room-preferences.mjs';

const limits = createRequestLimits();

export const prerender = false;

export async function POST({ request, clientAddress }) {
  const started = Date.now();
  try {
    const address = process.env.TRUST_CLOUDFLARE === '1' ? request.headers.get('cf-connecting-ip') || clientAddress : clientAddress;
    if (!limits.accept(address || 'local')) return json({error:'Please wait a minute before sending more questions.'},429);
    if (Number(request.headers.get('content-length') || 0) > 20_000) return json({ error:'Request is too large.' }, 413);
    const raw = await request.text();
    if (raw.length > 20_000) return json({ error:'Request is too large.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error:'Send a valid JSON request.' },400); }
    if (typeof body?.question !== 'string' || (body.question.trim().length < 2&&!/^\d$/.test(body.question.trim())) || body.question.length > 600) return json({ error:'Enter a question between 2 and 600 characters, or reply with a guest count.' }, 400);
    if (body.stay !== undefined && (body.stay === null || typeof body.stay !== 'object' || Array.isArray(body.stay))) return json({error:'Stay details must be an object.'},400);
    if(body.preferences!==undefined) try{normalizePreferences(body.preferences);}catch(error){return json({error:error.message},400);}
    if(body.bookingContext!==undefined){
      const context=body.bookingContext;
      if(!context||typeof context!=='object'||Array.isArray(context)||!context.stay||typeof context.stay!=='object'||Array.isArray(context.stay))return json({error:'Booking context is invalid.'},400);
      const {checkIn,checkOut,adults}=context.stay;
      if([checkIn,checkOut].some(value=>value!==undefined&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)))||(adults!==undefined&&(!Number.isInteger(adults)||adults<1||adults>4)))return json({error:'Booking context is invalid.'},400);
      try{body.bookingContext={stay:{...(checkIn?{checkIn}:{}),...(checkOut?{checkOut}:{}),...(adults?{adults}:{})},preferences:normalizePreferences(context.preferences)};}catch(error){return json({error:error.message},400);}
    }
    if (body.history !== undefined && (!Array.isArray(body.history) || body.history.length > 16 || body.history.some((turn) => !['user','assistant'].includes(turn?.role) || typeof turn.content !== 'string' || turn.content.length > 1200))) return json({ error:'Conversation context is invalid.' }, 400);
    const result = await answerQuestion(body, {
      apiKey: process.env.OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || import.meta.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL || import.meta.env.OPENAI_MODEL,
      modelTimeoutMs: process.env.OPENAI_TIMEOUT_MS || import.meta.env.OPENAI_TIMEOUT_MS,
      modelMaxTokens: process.env.OPENAI_MAX_TOKENS || import.meta.env.OPENAI_MAX_TOKENS,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || import.meta.env.OPENAI_EMBEDDING_MODEL,
      localAiUrl: process.env.LOCAL_AI_URL || import.meta.env.LOCAL_AI_URL,
      canCallModel: () => limits.reserveModelCall(),
      logger: console
    });
    console.info('chat_request', { type:result.type, durationMs:Date.now() - started });
    return json({...result, demo:true}, 200);
  } catch (error) {
    console.error('chat_request_failed', { durationMs:Date.now() - started, message:error.message });
    return json({ error:'The assistant is temporarily unavailable. Please try again.' }, 503);
  }
}

function json(body, status) { return new Response(JSON.stringify(body), { status, headers:{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' } }); }
