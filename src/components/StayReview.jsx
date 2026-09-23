import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BedDouble,Check,Copy,LockKeyhole,RefreshCw,ShieldCheck,X} from 'lucide-react';
import '../styles/booking.css';

const money=value=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(value);
const date=value=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

export default function StayReview({selection,onClose}) {
  const dialogRef=useRef(null);
  const headingRef=useRef(null);
  const requestRef=useRef(null);
  const [quote,setQuote]=useState(null);
  const [pending,setPending]=useState(true);
  const [error,setError]=useState('');
  const [phase,setPhase]=useState('review');
  const [copied,setCopied]=useState(false);
  const refresh=async(advance=false)=>{
    requestRef.current?.abort();
    const controller=new AbortController();
    requestRef.current=controller;
    setPending(true);setError('');
    try{
      const response=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selection),signal:controller.signal});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'The quote could not be refreshed.');
      setQuote(result);setCopied(false);
      if(advance)setPhase('handoff');
    }catch(cause){if(cause.name!=='AbortError'){setQuote(null);setError(cause instanceof TypeError?'Please check your connection and try again.':cause.message);}}
    finally{if(!controller.signal.aborted)setPending(false);}
  };
  useEffect(()=>{const dialog=dialogRef.current;dialog.showModal();return()=>dialog.close();},[]);
  useEffect(()=>{refresh();return()=>requestRef.current?.abort();},[selection]);
  useEffect(()=>{headingRef.current?.focus({preventScroll:true});dialogRef.current?.querySelector('.review-content')?.scrollTo({top:0});},[phase]);
  const copy=async()=>{
    try{await navigator.clipboard.writeText(`DEMO STAY · ${quote.property}\n${quote.room.name}\n${date(quote.checkIn)} – ${date(quote.checkOut)} · ${quote.guests} guests\nSample subtotal: ${money(quote.subtotal)}\n${quote.taxes}\n${quote.notice}`);setCopied(true);}catch{setError('Could not copy. You can select and copy the summary text.');}
  };
  return <dialog ref={dialogRef} className="stay-review" aria-labelledby="stay-review-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header className="review-header"><div><span className="review-eyebrow">{selection.autonomous?'YOUR AUTONOMOUS STAY PLANNER':'YOUR STAY, CONSIDERED'}</span><h2 ref={headingRef} tabIndex={-1} id="stay-review-title">{phase==='handoff'?'Payment handoff preview':'Your stay report'}</h2></div><button type="button" onClick={onClose} aria-label="Close stay review"><X size={20}/></button></header>
    <ol className="review-steps" aria-label="Booking preview steps"><li><Check size={13}/> Compare</li><li aria-current={phase==='review'?'step':undefined}>02 Review</li><li aria-current={phase==='handoff'?'step':undefined}>03 Payment preview</li></ol>
    <div className="review-content">
      <div className="review-demo"><ShieldCheck size={16}/><span>Demonstration only. No room is held or booked.</span></div>
      {pending&&<p className="review-status" role="status"><RefreshCw size={16} className="review-spin"/> Rechecking sample inventory and price…</p>}
      {error&&<div className="review-error" role="alert"><p>{error}</p><button type="button" onClick={()=>refresh()} disabled={pending}>Try again</button></div>}
      {quote&&<>
        {phase==='review'&&quote.report&&<section className="agent-report" aria-label="What your planner did"><h3>Everything checked. Ready for your review.</h3><ol>{quote.report.steps.map(step=><li key={step}><Check size={14}/><span>{step}</span></li>)}</ol><p className="report-reason">{quote.report.selectionReason}</p><div className="report-criteria"><span>{quote.report.preferences.nightlyBudget?`Up to €${quote.report.preferences.nightlyBudget}/night`:'No budget limit specified'}</span><span>{({any:'Any outlook',sea:'Sea view required',terrace:'Terrace required'})[quote.report.preferences.view]}</span><span>{quote.report.preferences.breakfastIncluded?'Included breakfast required':'Breakfast not a requirement'}</span></div>{quote.report.alternatives.length>0&&<details><summary>Other matching options ({quote.report.alternatives.length})</summary><ul>{quote.report.alternatives.map(room=><li key={room.id}><span>{room.name}</span><strong>{money(room.total)} total</strong></li>)}</ul></details>}<p className="report-scope">{quote.report.scope}</p></section>}
        {phase==='handoff'&&<div className="payment-preview"><LockKeyhole size={22}/><h3>The final step belongs to you.</h3><p>A connected hotel booking provider would receive your reviewed stay and open its secure checkout here.</p><dl><div><dt>Example guest</dt><dd>Demo Guest</dd></div><div><dt>Example email</dt><dd>guest@example.com</dd></div></dl><strong>No payment provider is connected.</strong><p>This preview collects no personal or card details and cannot take a payment. The example guest details are stub data.</p></div>}
        <div className="review-room"><span className="review-room-icon"><BedDouble size={26}/></span><div><span>{quote.property}</span><h3>{quote.room.name}</h3><p>{quote.room.bed} · {quote.room.areaSqm} m²</p></div></div>
        <dl className="review-details"><div><dt>Check-in</dt><dd>{date(quote.checkIn)} · 3 PM</dd></div><div><dt>Check-out</dt><dd>{date(quote.checkOut)} · 11 AM</dd></div><div><dt>Your stay</dt><dd>{quote.guests} guests · {quote.nights} {quote.nights===1?'night':'nights'}</dd></div><div><dt>Outlook</dt><dd>{quote.room.view}</dd></div><div><dt>Breakfast</dt><dd>{quote.room.breakfastIncluded?'Included':'Optional · €24 per adult/day'}</dd></div></dl>
        <div className="review-price"><div><span>{money(quote.room.basePrice)} × {quote.nights} nights</span><strong>{money(quote.subtotal)}</strong></div><div className="review-subtotal"><span>Sample subtotal</span><strong>{money(quote.subtotal)}</strong></div><p>{quote.taxes} Optional extras are not included.</p></div>
        {phase==='review'&&<>
          <details className="review-policy"><summary>Sample cancellation terms</summary><p>{quote.cancellation}</p><p>A connected provider must confirm the applicable rate plan before payment.</p></details>
          <p className="review-freshness">Rechecked at {new Date(quote.quotedAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}. Sample quote expires in 15 minutes; we recheck again before the preview.</p>
        </>}
      </>}
    </div>
    <footer className="review-footer">{phase==='review'?<><button type="button" className="review-secondary" onClick={onClose}><ArrowLeft size={15}/> Change my stay</button><button type="button" className="review-primary" disabled={pending||!quote} onClick={()=>refresh(true)}>Confirm & preview payment <ArrowRight size={16}/></button></>:<><button type="button" className="review-secondary" onClick={()=>setPhase('review')}><ArrowLeft size={15}/> Back to review</button><button type="button" className="review-primary" onClick={copy} disabled={pending||!quote}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Summary copied':'Copy stay summary'}</button></>}</footer>
  </dialog>;
}
