import React,{useEffect,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import '../styles/arrival.css';

export default function ArrivalReveal({onReady}) {
  const reduceMotion=useReducedMotion();
  const [leaving,setLeaving]=useState(false);
  const [finished,setFinished]=useState(false);
  useEffect(()=>{
    let cancelled=false,exitTimer;
    let returning=false;
    try{returning=sessionStorage.getItem('simplotel-arrived')==='yes';sessionStorage.setItem('simplotel-arrived','yes');}catch{}
    const minimum=reduceMotion?100:returning?350:1100;
    const fonts=document.fonts?.ready||Promise.resolve();
    Promise.all([new Promise(resolve=>setTimeout(resolve,minimum)),Promise.race([fonts,new Promise(resolve=>setTimeout(resolve,1800))])]).then(()=>{
      if(cancelled)return;
      setLeaving(true);onReady(true);
      exitTimer=setTimeout(()=>setFinished(true),reduceMotion?20:650);
    });
    return()=>{cancelled=true;clearTimeout(exitTimer);};
  },[reduceMotion,onReady]);
  if(finished)return null;
  return <div className={`arrival-reveal ${leaving?'is-leaving':''}`} aria-hidden="true">
    <div className="arrival-grain"/>
    <div className="arrival-centre"><div className="arrival-seal"><span/><img src="/concierge-mark.webp" width="72" height="78" alt=""/></div><img className="arrival-brand" src="/simplotel-logo.png" alt="" width="154"/><span className="arrival-caption">GUEST CONCIERGE</span><p>A little closer<br/>to your perfect stay.</p><div className="arrival-track"><i/></div><span className="arrival-footnote">MAKE YOURSELF AT HOME</span></div>
  </div>;
}
