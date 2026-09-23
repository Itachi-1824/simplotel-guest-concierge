import {createQuote} from '../../lib/booking.mjs';
import {createRequestLimits} from '../../lib/request-limits.mjs';

export const prerender=false;
const limits=createRequestLimits();
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});

export async function POST({request,clientAddress}) {
  const started=Date.now();
  try {
    const address=process.env.TRUST_CLOUDFLARE==='1'?request.headers.get('cf-connecting-ip')||clientAddress:clientAddress;
    if(!limits.accept(address||'local')) return json({error:'Please wait a minute before requesting another quote.'},429);
    if(Number(request.headers.get('content-length')||0)>4000) return json({error:'Request is too large.'},413);
    const raw=await request.text();
    if(raw.length>4000) return json({error:'Request is too large.'},413);
    let body;
    try {body=JSON.parse(raw);} catch {return json({error:'Send a valid JSON request.'},400);}
    const result=createQuote(body);
    console.info('quote_request',{ok:result.ok,durationMs:Date.now()-started});
    return result.ok?json(result.quote):json({error:result.error},result.status);
  } catch {
    console.error('quote_request_failed',{durationMs:Date.now()-started});
    return json({error:'The quote could not be refreshed. Please try again.'},503);
  }
}
