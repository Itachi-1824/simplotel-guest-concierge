import { answerQuestion } from '../../lib/assistant.mjs';

export const prerender = false;

export async function POST({ request }) {
  const started = Date.now();
  try {
    if (Number(request.headers.get('content-length') || 0) > 20_000) return json({ error:'Request is too large.' }, 413);
    const raw = await request.text();
    if (raw.length > 20_000) return json({ error:'Request is too large.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error:'Send a valid JSON request.' },400); }
    if (typeof body?.question !== 'string' || body.question.trim().length < 2 || body.question.length > 600) return json({ error:'Enter a question between 2 and 600 characters.' }, 400);
    if (body.stay !== undefined && (body.stay === null || typeof body.stay !== 'object' || Array.isArray(body.stay))) return json({error:'Stay details must be an object.'},400);
    if (body.history !== undefined && (!Array.isArray(body.history) || body.history.length > 16 || body.history.some((turn) => !['user','assistant'].includes(turn?.role) || typeof turn.content !== 'string' || turn.content.length > 1200))) return json({ error:'Conversation context is invalid.' }, 400);
    const result = await answerQuestion(body, {
      apiKey: process.env.OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || import.meta.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL || import.meta.env.OPENAI_MODEL,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || import.meta.env.OPENAI_EMBEDDING_MODEL,
      localAiUrl: process.env.LOCAL_AI_URL || import.meta.env.LOCAL_AI_URL,
      logger: console
    });
    console.info('chat_request', { type:result.type, durationMs:Date.now() - started });
    return json(result, 200);
  } catch (error) {
    console.error('chat_request_failed', { durationMs:Date.now() - started, message:error.message });
    return json({ error:'The assistant is temporarily unavailable. Please try again.' }, 503);
  }
}

function json(body, status) { return new Response(JSON.stringify(body), { status, headers:{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' } }); }
