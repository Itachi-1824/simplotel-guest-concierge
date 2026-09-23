import {useEffect,useRef,useState} from 'react';

const KEY='simplotel-sound';

export default function useSound() {
  const [enabled,setEnabled]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const noticeTimer=useRef(null);
  const active=useRef(false);
  const context=useRef(null);
  const ready=async()=>{
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw new Error('Sound is unavailable in this browser.');
    if(!context.current||context.current.state==='closed')context.current=new Audio();
    if(context.current.state!=='running')await context.current.resume();
    return context.current;
  };
  const play=async(type='send')=>{
    if(!active.current)return;
    try{
      const audio=await ready();
      if(!active.current||audio.state!=='running')return;
      const notes=type==='receive'?[523.25,659.25,783.99]:type==='enabled'?[392,523.25,659.25]:[392,493.88];
      notes.forEach((frequency,index)=>{
        const start=audio.currentTime+.015+index*.095;
        const osc=audio.createOscillator(),gain=audio.createGain();
        osc.type='sine';osc.frequency.value=frequency;
        gain.gain.setValueAtTime(.0001,start);
        gain.gain.exponentialRampToValueAtTime(.11,start+.016);
        gain.gain.exponentialRampToValueAtTime(.0001,start+.3);
        osc.connect(gain).connect(audio.destination);
        osc.start(start);osc.stop(start+.32);
        osc.onended=()=>{osc.disconnect();gain.disconnect();};
      });
      setError('');
    }catch(cause){setError(cause.message||'Sound could not start. Tap the sound button to try again.');}
  };
  const toggle=()=>{
    const next=!active.current;
    active.current=next;setEnabled(next);setError('');
    setNotice(next?'Sound on · gentle message tones':'Sound off');
    clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(''),3000);
    try{localStorage.setItem(KEY,next?'on':'off');}catch{}
    if(next)void play('enabled');
  };
  useEffect(()=>{
    try{active.current=localStorage.getItem(KEY)==='on';setEnabled(active.current);}catch{}
    const unlock=()=>{if(active.current)ready().catch(()=>{});};
    window.addEventListener('pointerdown',unlock);
    window.addEventListener('keydown',unlock);
    return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);clearTimeout(noticeTimer.current);context.current?.close().catch(()=>{});};
  },[]);
  return {enabled,toggle,play,error,notice};
}
