import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowRight, ArrowUpRight, BedDouble, CalendarDays, Check, CircleHelp, Clock3, Compass, Copy, HelpCircle, Home, Menu, MessageSquareText, Minus, Moon, Plus, RotateCcw, Send, ShieldCheck, Square, Sun, Volume2, VolumeX, Waves, X } from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import SessionDrawer from './SessionDrawer.jsx';
import StayReview from './StayReview.jsx';
import ArrivalReveal from './ArrivalReveal.jsx';
import HotelContact from './HotelContact.jsx';
import useSound from '../lib/use-sound.js';
import { SESSION_KEY, TOUR_KEY, autoTitle, createFolder, createSession, loadSavedSessions } from '../lib/sessions.mjs';
import '../styles/global.css';
import '../styles/journey.css';
import '../styles/concierge.css';
import '../styles/history.css';
import '../styles/refinements.css';

const suggestions = [
  { label:'When can I check in?', icon:Clock3, question:'What time is check-in and check-out?' },
  { label:'Explore the rooms', icon:Sun, question:'Which room is suitable for three guests?' },
  { label:'Breakfast & dining', icon:Waves, question:'Is breakfast included?' },
  { label:'Cancellation policy', icon:ShieldCheck, question:'What is the cancellation policy?' },
];
const discoveries = [
  { label:'The suite', kicker:'01 / SPACE TO EXHALE', title:'Wake up where the sea begins.', text:'The Terrace Suite brings the coast into your room. A king bed, a comfortable sofa bed and your own private terrace give up to three guests room to slow down.', detail:'42 m² · Up to 3 guests · From €390/night', ask:'Tell me about the Terrace Suite' },
  { label:'The morning', kicker:'02 / RITUALS TO SAVOUR', title:'Mornings, made unhurried.', text:'Breakfast is included with the Terrace and Horizon Suites. In our other rooms, add breakfast when it suits you. The day starts on your terms.', detail:'Suite breakfast included · Other rooms €24/adult/day', ask:'Is breakfast included?' },
  { label:'The little things', kicker:'03 / MORE TO DISCOVER', title:'The details are the destination.', text:'Begin with a swim in the outdoor sea-view pool, then make an evening of coastal Italian dining at Sera. Ask the concierge for opening times and anything else worth knowing.', detail:'Pool 7 AM–8 PM · Sera dinner 6:30–10 PM', ask:'Tell me about the pool and restaurant' }
];
const initialMessage = { id:0, role:'assistant', content:'Welcome to your Simplotel stay planner. Tell me your dates, guests, and preferences; I will compare The Cove Hotel’s sample rooms and prepare your stay for review. I can also answer hotel questions. This demo makes no bookings or payments.', type:'welcome' };
const tomorrow = (offset = 0) => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0,10); };


function RoomCard({ room, index, reduceMotion, onReview }) {
  const breakfastIncluded=room.breakfastIncluded??['terrace','horizon'].includes(room.id);
  return <motion.div className="room-offer" initial={reduceMotion ? false : { opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:index * .08 }}>
    {index===0&&<span className="offer-badge">LOWEST MATCHING SAMPLE RATE</span>}
    <div className="room-card">
    <div className="room-symbol">{room.id === 'classic' ? <Sun size={20}/> : room.id === 'sea-view' ? <Waves size={20}/> : room.id === 'terrace' ? <Moon size={20}/> : <Compass size={20}/>}</div>
    <div className="room-copy"><div className="room-name">{room.name}</div><div className="room-description">{room.bed ? `${room.bed} · ${room.areaSqm} m² · ${room.view}` : room.description}</div><div className="room-meta">Up to {room.capacity} guests <span>·</span> {room.available} left in sample inventory</div></div>
    <div className="room-rate"><strong>€{room.total.toLocaleString()}</strong><span>total · {room.basePrice}/night</span></div>
    </div><div className="room-offer-footer"><span>{breakfastIncluded?'Breakfast included':'Breakfast optional · €24/adult/day'}</span><button type="button" onClick={onReview} aria-label={`Review ${room.name}`}>Review this stay <ArrowUpRight size={14}/></button></div>
  </motion.div>;
}

function Message({ message, reduceMotion, retry, onReview, onEditStay, onContact }) {
  const isGuest = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false),2000); } catch { setCopied(false); } };
  return <motion.div className={`message-row ${isGuest ? 'guest' : 'assistant'}`} initial={reduceMotion ? false : {opacity:0, y:14, scale:.985}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.34, ease:[.22,1,.36,1]}}>
    {!isGuest && <div className="avatar" aria-hidden="true"><img src="/concierge-mark.webp" alt="" width="24" height="26"/></div>}
    <div className="message-body">
      <div className="message-author">{isGuest ? 'You' : 'Simplotel concierge'} {message.createdAt && <span>· {new Date(message.createdAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span>}</div>
      <div className={`bubble ${message.type === 'error' ? 'error-bubble' : ''}`}>{message.content}</div>
      {message.sources?.length > 0 && <div className="source-line"><ShieldCheck size={13}/> Sample hotel guide: {message.sources.map((source) => source.topic).filter((item,index,array) => array.indexOf(item) === index).join(', ')}</div>}
      {(message.sources?.some(source=>['contact','location'].includes(source.id))||['fallback','clarification'].includes(message.type))&&<button type="button" className="contact-answer-action" onClick={onContact}>Hotel contact & location <ArrowUpRight size={14}/></button>}
      {message.availability && <div className="availability-result">
        <div className="result-heading"><CalendarDays size={15}/> {new Date(`${message.availability.checkIn}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {new Date(`${message.availability.checkOut}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} <span>· {message.availability.adults} {message.availability.adults === 1 ? 'guest' : 'guests'}</span></div>
        {message.availability.preferences&&<p className="preference-summary">{message.availability.preferences.nightlyBudget ? `Up to €${message.availability.preferences.nightlyBudget}/night` : 'Any nightly budget'} · {({any:'Any outlook',sea:'Sea view',terrace:'With a terrace'})[message.availability.preferences.view]}{message.availability.preferences.breakfastIncluded?' · Breakfast included':''}</p>}
        {message.availability.rooms.length ? message.availability.rooms.map((room,index) => <RoomCard key={room.id} room={room} index={index} reduceMotion={reduceMotion} onReview={()=>onReview({roomId:room.id,stay:{checkIn:message.availability.checkIn,checkOut:message.availability.checkOut,adults:message.availability.adults},preferences:message.availability.preferences})}/>) : <div className="no-rooms"><p>Adjust your dates, guests, or preferences.</p><button type="button" className="review-secondary" onClick={()=>onEditStay(message.availability)}>Change stay preferences</button></div>}
        {message.availability.alternatives?.length>0&&<div className="nearby-stays"><h4>Nearby dates · Same guests & preferences</h4>{message.availability.alternatives.map(option=><div className="nearby-stay" key={`${option.checkIn}-${option.room.id}`}><div><strong>{new Date(`${option.checkIn}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {new Date(`${option.checkOut}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</strong><span>{option.room.name} · {option.nights} nights · €{option.room.total.toLocaleString()} total</span></div><button type="button" onClick={()=>onReview({roomId:option.room.id,stay:{checkIn:option.checkIn,checkOut:option.checkOut,adults:option.adults},preferences:message.availability.preferences})}>Review these dates <ArrowUpRight size={14}/></button></div>)}</div>}
        <p className="inventory-note">Illustrative rates and inventory · No reservation is made</p>
      </div>}
      {!isGuest && message.type !== 'welcome' && <div className="message-actions"><button type="button" onClick={copy} aria-label={copied ? 'Answer copied' : 'Copy answer'}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? 'Copied' : 'Copy'}</button>{message.type === 'error' && <button type="button" onClick={retry}><RotateCcw size={13}/> Try again</button>}</div>}
    </div>
  </motion.div>;
}

export default function GuestExperience({hotel}) {
  const reduceMotion = useReducedMotion();
  const { enabled:soundEnabled, toggle:toggleSound, play, error:soundError, notice:soundNotice } = useSound();
  const [arrivalReady,setArrivalReady]=useState(false);
  const [activeScene,setActiveScene]=useState(0);
  const [messages, setMessages] = useState([initialMessage]);
  const [sessions, setSessions] = useState(() => [createSession(initialMessage, 'initial')]);
  const [folders, setFolders] = useState([]);
  const [activeId, setActiveId] = useState('initial');
  const [sessionReady, setSessionReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [question, setQuestion] = useState('');
  const [heroQuestion, setHeroQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [nightlyBudget,setNightlyBudget]=useState('');
  const [roomView,setRoomView]=useState('any');
  const [roomId,setRoomId]=useState(null);
  const [breakfastIncluded,setBreakfastIncluded]=useState(false);
  const [reviewSelection,setReviewSelection]=useState(null);
  const [contactOpen,setContactOpen]=useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [heroOffset, setHeroOffset] = useState({x:0,y:0});
  const [discoveryTab, setDiscoveryTab] = useState(0);
  const chatEnd = useRef(null);
  const journeyRef = useRef(null);
  const conversationRef = useRef(null);
  const activeSceneRef = useRef(0);
  const requestRef = useRef(null);
  const questionRef = useRef(null);
  const plannerCloseRef = useRef(null);
  const tourRef = useRef(null);
  const goToScene = (index, instant = false) => {
    activeSceneRef.current = index;
    setActiveScene(index);
    window.history.replaceState(null,'',['#top','#conversation','#discover'][index]);
    journeyRef.current?.scrollTo({top:index * journeyRef.current.clientHeight,behavior:instant || reduceMotion ? 'instant' : 'smooth'});
  };
  useEffect(() => {
    let saved;
    try { saved = loadSavedSessions(localStorage.getItem(SESSION_KEY), initialMessage); } catch { setStorageError(true); }
    if (saved) {
      const active = saved.sessions.find((item) => item.id === saved.activeId);
      const next = active || createSession(initialMessage);
      setSessions(active ? saved.sessions : [...saved.sessions, next]);
      setFolders(saved.folders);
      setActiveId(next.id);
      setMessages(next.messages);
    }
    setSessionReady(true);
  }, []);
  useEffect(() => {
    if (!sessionReady) return;
    setSessions((old) => old.map((session) => session.id === activeId ? {
      ...session,
      title:session.manualTitle || session.title !== 'New conversation' ? session.title : autoTitle(messages.find((message) => message.role === 'user')?.content),
      messages,
      updatedAt:new Date().toISOString()
    } : session));
  }, [messages, activeId, sessionReady]);
  useEffect(() => { if (sessionReady) { try { localStorage.setItem(SESSION_KEY, JSON.stringify({sessions,folders,activeId})); } catch { setStorageError(true); } } }, [sessions,folders,activeId,sessionReady]);
  const newSession = () => { if (loading) return; const next = createSession(initialMessage); setSessions((old) => [next,...old]); setActiveId(next.id); setMessages(next.messages); setError(''); };
  const selectSession = (id) => { if (loading) return; const found = sessions.find((item) => item.id === id && !item.archived); if (found) { setActiveId(id); setMessages(found.messages); setError(''); } };
  const renameSession = (id, title) => setSessions((old) => old.map((item) => item.id === id ? {...item,title:title.slice(0,60),manualTitle:true} : item));
  const archiveSession = (id) => { if (loading && id === activeId) return; setSessions((old) => old.map((item) => item.id === id ? {...item,archived:!item.archived} : item)); if (id === activeId) { const replacement = sessions.find((item) => item.id !== id && !item.archived); if (replacement) { setActiveId(replacement.id); setMessages(replacement.messages); } else newSession(); } };
  const deleteSession = (id) => { if (loading && id === activeId) return; setSessions((old) => old.filter((item) => item.id !== id)); if (id === activeId) { const replacement = sessions.find((item) => item.id !== id && !item.archived); if (replacement) { setActiveId(replacement.id); setMessages(replacement.messages); } else newSession(); } };
  const moveSession = (id, folderId) => setSessions((old) => old.map((item) => item.id === id ? {...item,folderId} : item));
  const addFolder = (name) => { const folder = createFolder(name); if (!folder || folders.some((item) => item.name.toLowerCase() === folder.name.toLowerCase())) return false; setFolders((old) => [...old,folder]); return true; };
  const renameFolder = (id, name) => setFolders((old) => old.map((item) => item.id === id ? {...item,name:name.slice(0,50)} : item));
  const deleteFolder = (id) => { setFolders((old) => old.filter((item) => item.id !== id)); setSessions((old) => old.map((item) => item.folderId === id ? {...item,folderId:null} : item)); };
  const startTour = () => {
    try { localStorage.setItem(TOUR_KEY,'seen'); } catch {}
    tourRef.current?.destroy();
    setPlannerOpen(false); setHistoryOpen(false);
    goToScene(1,true);
    window.setTimeout(() => {
      const tour = driver({animate:!reduceMotion,popoverClass:'simplotel-tour',showProgress:true,progressText:'{{current}} of {{total}}',nextBtnText:'Next',prevBtnText:'Back',doneBtnText:'Start exploring',overlayColor:'#153b3b',overlayOpacity:.62,allowClose:true,onDestroyed:() => setHistoryOpen(false),steps:[
        {element:'#conversation .chat-persona',popover:{title:'Your guest concierge',description:'Explore The Cove Hotel, a fictional property. Rooms, rates, policies, and availability are sample data for this assessment. No bookings or payments are made.'}},
        {element:'#question',popover:{title:'Ask in your own words',description:'Tell me your dates, guests, budget, and room preferences in one message. I compare sample rooms and prepare a stay report automatically. I ask for any missing essentials here.'}},
        {element:'.prompt-row',popover:{title:'Need a place to start?',description:'These quick questions give you an easy first step. You can always type something different.'}},
        {element:'.mobile-stay-button',popover:{title:'Check your dates',description:'Prefer a form? Your chat details fill it automatically. Review the prepared stay report, then confirm the payment preview. This demo cannot reserve rooms or take payment.'}},
        {element:'#history-trigger',popover:{title:'Save your plans',description:'Your chats are saved on this device. Open here to rename, archive, delete, or organize them.',onNextClick:(_element,_step,{driver:activeTour}) => { setHistoryOpen(true); window.setTimeout(() => activeTour.moveNext(),400); }}},
        {element:'#tour-folders',waitForElement:1200,popover:{title:'Folders for places',description:'Create a folder named after a city or country, such as Italy. Move related conversations into it so your travel plans stay together.',onPrevClick:(_element,_step,{driver:activeTour}) => { setHistoryOpen(false); window.setTimeout(() => activeTour.movePrevious(),400); }}},
        {element:'#tour-new-chat',popover:{title:'Begin another conversation',description:'Start fresh whenever you like. Return to any saved chat from this panel, and replay this guide with the Guide button or from the panel footer.'}}
      ]});
      tourRef.current = tour; tour.drive();
    }, reduceMotion ? 40 : 600);
  };
  useEffect(() => {
    if (!sessionReady || !arrivalReady || activeScene !== 1) return;
    try { if (localStorage.getItem(TOUR_KEY)) return; } catch { return; }
    const timer = window.setTimeout(() => {
      if (activeSceneRef.current !== 1 || tourRef.current?.isActive()) return;
      try { if (localStorage.getItem(TOUR_KEY)) return; } catch { return; }
      startTour();
    },1500);
    return () => clearTimeout(timer);
  }, [sessionReady,arrivalReady,activeScene]);
  useEffect(() => { const conversation = conversationRef.current; if (conversation && (messages.length > 1 || loading)) conversation.scrollTo({top:conversation.scrollHeight,behavior:reduceMotion ? 'instant' : 'smooth'}); }, [messages, loading, reduceMotion]);
  useEffect(() => { const field = questionRef.current; if (field) { field.style.height = 'auto'; field.style.height = `${Math.min(field.scrollHeight,120)}px`; } }, [question]);
  useEffect(() => { if (plannerOpen) plannerCloseRef.current?.focus(); }, [plannerOpen]);
  useEffect(() => {
    if (!historyOpen && !plannerOpen) return;
    const previous = document.activeElement;
    const drawer = document.querySelector(historyOpen ? '.history-drawer' : '.side-column');
    const focusTimer = setTimeout(() => drawer?.querySelector('button')?.focus(),100);
    const close = (event) => {
      if (tourRef.current?.isActive()) return;
      if (event.key === 'Escape') { setPlannerOpen(false); setHistoryOpen(false); }
      if (event.key === 'Tab') {
        const nodes = [...(drawer?.querySelectorAll('button:not(:disabled),input,select,a[href]') || [])].filter((node) => node.offsetParent !== null);
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown',close);
    return () => { clearTimeout(focusTimer); window.removeEventListener('keydown',close); previous?.focus?.({preventScroll:true}); };
  }, [historyOpen,plannerOpen]);
  useEffect(() => {
    const scroller = journeyRef.current;
    if (!scroller) return;
    let locked = false;
    let releaseTimer;
    const slides = () => [document.querySelector('.landing-scene'), document.querySelector('.workspace'), document.getElementById('discover')].filter(Boolean);
    const onScroll = () => { if (!locked) { activeSceneRef.current = Math.max(0,Math.min(2,Math.round(scroller.scrollTop / scroller.clientHeight))); setActiveScene(activeSceneRef.current); } };
    const onWheel = (event) => {
      if (Math.abs(event.deltaY) < 8 || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.ctrlKey) return;
      if (plannerOpen || historyOpen || tourRef.current?.isActive() || event.target.closest('input, textarea, .history-drawer, .side-column')) return;
      const conversation = event.target.closest('.conversation');
      if (conversation && conversation.scrollHeight > conversation.clientHeight + 2) return;
      const story = event.target.closest('.story-section');
      if (story && story.scrollHeight > story.clientHeight + 2 && (event.deltaY > 0 ? story.scrollTop + story.clientHeight < story.scrollHeight - 2 : story.scrollTop > 2)) return;
      event.preventDefault();
      if (locked) return;
      const scenes = slides();
      const positions = scenes.map((scene) => scene.getBoundingClientRect().top);
      const current = positions.reduce((best, position, index) => Math.abs(position) < Math.abs(positions[best]) ? index : best, 0);
      const next = Math.max(0, Math.min(scenes.length - 1, current + Math.sign(event.deltaY)));
      if (next === current) return;
      locked = true;
      activeSceneRef.current = next;
      setActiveScene(next);
      scroller.scrollTo({top:next * scroller.clientHeight,behavior:reduceMotion ? 'instant' : 'smooth'});
      window.history.replaceState(null,'',['#top','#conversation','#discover'][next]);
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => { locked = false; }, 850);
    };
    scroller.addEventListener('wheel', onWheel, {passive:false});
    scroller.addEventListener('scroll',onScroll,{passive:true});
    return () => {scroller.removeEventListener('wheel',onWheel); scroller.removeEventListener('scroll',onScroll); clearTimeout(releaseTimer);};
  }, [reduceMotion, plannerOpen,historyOpen]);
  useEffect(() => {
    let frame;
    activeSceneRef.current = window.location.hash === '#discover' ? 2 : window.location.hash === '#conversation' ? 1 : 0;
    setActiveScene(activeSceneRef.current);
    const resize = () => {
      const index = activeSceneRef.current;
      document.documentElement.style.setProperty('--app-height',`${window.visualViewport?.height || window.innerHeight}px`);
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(() => { journeyRef.current?.scrollTo({top:index * journeyRef.current.clientHeight,behavior:'instant'}); activeSceneRef.current=index; });
    };
    resize();
    window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
    return () => {cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};
  }, []);

  const editStay = (stay,open=true) => {
    if(stay.checkIn)setCheckIn(stay.checkIn);
    if(stay.checkOut)setCheckOut(stay.checkOut);
    if(stay.adults)setGuests(stay.adults);
    const preferences=stay.preferences||{};
    setRoomId(preferences.roomId||null);setNightlyBudget(preferences.nightlyBudget??'');setRoomView(preferences.view||'any');setBreakfastIncluded(Boolean(preferences.breakfastIncluded));
    if(open)setPlannerOpen(true);
  };

  const sendQuestion = async (text, stay, preferences) => {
    const value = text.trim();
    if (!value || loading) return;
    setError(''); setLoading(true); setQuestion(''); play('send');
    const history = messages.filter((message) => message.id !== 0).map(({role,content}) => ({role,content})).slice(-8);
    const lastStay=messages.findLast(message=>message.role==='assistant'&&(message.availability||message.bookingContext));
    const bookingContext=lastStay?.bookingContext||(lastStay?.availability?{stay:{checkIn:lastStay.availability.checkIn,checkOut:lastStay.availability.checkOut,adults:lastStay.availability.adults},preferences:lastStay.availability.preferences}:undefined);
    const guestMessage = {id:Date.now(),role:'user',content:value,createdAt:new Date().toISOString()};
    setMessages((previous) => [...previous, guestMessage]);
    try {
      requestRef.current = new AbortController();
      const response = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, signal:requestRef.current.signal, body:JSON.stringify({question:value,history,...(bookingContext?{bookingContext}:{}), ...(stay ? {stay} : {}),...(preferences?{preferences}:{})}) });
      let result;
      try { result = await response.json(); } catch { throw new Error('We could not read the response. Please try again.'); }
      if (!response.ok) throw new Error(result.error || 'The concierge is unavailable right now.');
      setMessages((previous) => [...previous, {id:Date.now()+1,role:'assistant',content:result.answer,type:result.type,sources:result.sources,availability:result.availability,...(result.stay?{bookingContext:{stay:result.stay,preferences:result.preferences}}:{}),createdAt:new Date().toISOString()}]);
      if (result.type === 'availability-needed') editStay({...result.stay,preferences:result.preferences},false);
      if(result.availability)editStay(result.availability,false);
      if(result.bookingPlan)setReviewSelection(result.bookingPlan);
      play('receive');
    } catch (cause) {
      if (cause.name === 'AbortError') { setMessages((previous) => [...previous,{id:Date.now()+1,role:'assistant',content:'Response stopped. You can ask again whenever you’re ready.',type:'stopped'}]); return; }
      const copy = cause instanceof TypeError ? 'Please check your connection and try again.' : cause.message || 'Something went wrong. Please try again.';
      setError(copy);
      setMessages((previous) => [...previous, {id:Date.now()+1,role:'assistant',content:`I’m sorry, I couldn’t connect just now. ${copy}`,type:'error',retryQuestion:value}]);
    } finally { setLoading(false); requestRef.current = null; }
  };

  const submitStay = (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const selectedCheckIn = String(fields.get('checkIn') || '');
    const selectedCheckOut = String(fields.get('checkOut') || '');
    if (!selectedCheckIn || !selectedCheckOut) { setError('Choose both dates to check availability.'); return; }
    if (selectedCheckOut <= selectedCheckIn) { setError('Check-out needs to be after check-in.'); return; }
    setPlannerOpen(false);
    sendQuestion(`Check availability for ${guests} ${guests === 1 ? 'guest' : 'guests'} from ${selectedCheckIn} to ${selectedCheckOut}`, {checkIn:selectedCheckIn,checkOut:selectedCheckOut,adults:guests},{nightlyBudget:nightlyBudget===''?null:Number(nightlyBudget),view:roomView,breakfastIncluded,roomId});
    goToScene(1);
  };

  const askSuggestion = (text) => { sendQuestion(text); setPlannerOpen(false); goToScene(1); };
  return <div className="app-shell">
    <ArrivalReveal onReady={setArrivalReady}/>
    <div className={`sound-feedback ${soundError||soundNotice?'visible':''}`} role="status">{soundError||soundNotice}</div>
    <div className="ambient ambient-one" aria-hidden="true"/><div className="ambient ambient-two" aria-hidden="true"/>
    <main id="top" className="journey" ref={journeyRef}>
    <section className="landing-scene" aria-label="Welcome to Simplotel Guest Concierge">
    <header className="site-header">
      <a href="#top" onClick={(event) => {event.preventDefault();goToScene(0);}} className="brand simplotel-brand" aria-label="Simplotel Guest Concierge home"><span className="simplotel-logo-wrap"><img src="/simplotel-logo.png" alt="Simplotel"/></span><span className="brand-product">GUEST CONCIERGE</span></a>
      <nav className={`desktop-nav ${mobileMenu ? 'show' : ''}`} aria-label="Main navigation">
        <a href="#conversation" onClick={(event) => {event.preventDefault();setMobileMenu(false);goToScene(1);}}>Concierge</a><a href="#discover" onClick={(event) => {event.preventDefault();setMobileMenu(false);goToScene(2);}}>Explore the hotel</a><a href="#stay-planner" onClick={(event) => { setMobileMenu(false); event.preventDefault(); setPlannerOpen(true); }}>Check a stay</a>
      </nav>
      <div className="header-actions"><span className="location-pill"><span className="live-dot"/> Amalfi Coast, Italy</span><button className="mobile-menu-button" type="button" aria-label={mobileMenu ? 'Close menu' : 'Open menu'} onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={20}/> : <Menu size={20}/>}</button></div>
    </header>

      <section className="hero" id="experience" onPointerMove={(event) => { if (reduceMotion || event.pointerType === 'touch') return; const rect=event.currentTarget.getBoundingClientRect(); setHeroOffset({x:((event.clientX-rect.left)/rect.width-.5)*12,y:((event.clientY-rect.top)/rect.height-.5)*12}); }} onPointerLeave={() => setHeroOffset({x:0,y:0})}>
        <motion.div className="hero-image" animate={reduceMotion ? {} : {x:heroOffset.x,y:heroOffset.y}} transition={{type:'spring',stiffness:40,damping:18}}/>
        <div className="hero-shade"/><div className="hero-glow"/>
        <div className="hero-content"><motion.div className="eyebrow" initial={reduceMotion ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.7}}>SIMPLOTEL GUEST CONCIERGE <span/></motion.div>
          <motion.h1 initial={reduceMotion ? false : {opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:.85,delay:.1}}>Every great stay<br/><em>starts with a question.</em></motion.h1>
          <motion.p initial={reduceMotion ? false : {opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.8,delay:.24}}>Explore The Cove Hotel, discover the right room, and plan with confidence. Thoughtful answers can lead to better direct bookings.</motion.p>
          <motion.form className="hero-ask-form" onSubmit={(event) => {event.preventDefault();if(heroQuestion.trim()){askSuggestion(heroQuestion);setHeroQuestion('');}}} initial={reduceMotion ? false : {opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.8,delay:.34}}>
            <label htmlFor="hero-question">Ask the concierge</label>
            <div><input id="hero-question" value={heroQuestion} onChange={(event) => setHeroQuestion(event.target.value)} maxLength={600} placeholder="What would you like to know?"/><button type="submit" disabled={!heroQuestion.trim() || loading} aria-label="Ask Simplotel"><ArrowUpRight size={20}/></button></div>
            <span>ROOMS, BREAKFAST, POLICIES, AVAILABILITY — START HERE</span>
          </motion.form>
        </div>
        <div className="hero-index"><span>01 / 03</span><div><i/></div><span>YOUR DIRECT STAY STARTS HERE</span></div>
        <a className="scroll-cue" href="#conversation" onClick={(event) => {event.preventDefault();goToScene(1);}} aria-label="Scroll to the concierge"><ArrowDown size={17}/></a>
      </section>

      <section className="intro-strip" id="main-content"><div><span className="intro-star">✳</span><p>From a question to a confident direct stay.</p></div><span className="intro-secondary">EXPLORE <span>·</span> ASK <span>·</span> PLAN</span></section>
    </section>

      <section className="story-section" id="discover" aria-label="Discover The Cove Hotel">
        <motion.div className="story-image-wrap" initial={reduceMotion ? false : {opacity:0,x:-45}} whileInView={{opacity:1,x:0}} viewport={{once:true,amount:.18}} transition={{duration:.85,ease:[.22,1,.36,1]}}>
          <img src="/terrace-suite.png" alt="Sea-facing suite and private terrace at The Cove Hotel" loading="lazy" />
          <div className="story-image-label"><span>THE TERRACE SUITE</span><span>THE COVE HOTEL / 01</span></div>
          <div className="story-orbit" aria-hidden="true"><Waves size={42} strokeWidth={1.2}/></div>
        </motion.div>
        <div className="story-copy">
          <motion.div initial={reduceMotion ? false : {opacity:0,y:25}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.2}} transition={{duration:.7}}>
            <div className="story-overline"><span>DEMO PROPERTY · THE COVE HOTEL</span><i/></div>
            <p className="story-edition">A house for curious travellers, quiet mornings and all the moments between.</p>
            <div className="story-tabs" role="tablist" aria-label="Explore the stay">{discoveries.map((item,index) => <button key={item.label} id={`story-tab-${index}`} type="button" role="tab" aria-selected={discoveryTab === index} aria-controls="story-panel" onClick={() => setDiscoveryTab(index)}>{item.label}</button>)}</div>
            <AnimatePresence mode="wait"><motion.div key={discoveryTab} id="story-panel" role="tabpanel" aria-labelledby={`story-tab-${discoveryTab}`} className="story-panel" initial={reduceMotion ? false : {opacity:0,y:14}} animate={{opacity:1,y:0}} exit={reduceMotion ? {} : {opacity:0,y:-10}} transition={{duration:.3}}>
              <span className="story-kicker">{discoveries[discoveryTab].kicker}</span>
              <h2>{discoveries[discoveryTab].title}</h2>
              <p>{discoveries[discoveryTab].text}</p>
              <div className="story-detail"><span className="detail-diamond">◇</span>{discoveries[discoveryTab].detail}</div>
              <button className="story-ask" type="button" onClick={() => askSuggestion(discoveries[discoveryTab].ask)}>Ask the concierge about this <ArrowUpRight size={17}/></button>
            </motion.div></AnimatePresence>
          </motion.div>
        </div>
        <a className="story-next" href="#conversation" onClick={(event) => {event.preventDefault();goToScene(1);}}>RETURN TO YOUR CONCIERGE <ArrowUpRight size={17}/></a>
        <footer className="story-footer">Simplotel Guest Concierge concept <span>·</span> The Cove Hotel is a fictional demo property</footer>
      </section>

      <div className="workspace">
        {plannerOpen && <button className="planner-overlay" type="button" aria-label="Close stay planner" onClick={() => setPlannerOpen(false)} />}
        <aside className={`side-column ${plannerOpen ? 'planner-open' : ''}`} inert={!plannerOpen} role={plannerOpen ? 'dialog' : undefined} aria-modal={plannerOpen ? 'true' : undefined} aria-label={plannerOpen ? 'Plan your stay' : undefined}>
          <button ref={plannerCloseRef} className="planner-close" type="button" aria-label="Close stay planner" onClick={() => setPlannerOpen(false)}><X size={20}/></button>
          <motion.div className="stay-card" id="stay-planner" initial={reduceMotion ? false : {opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.2}} transition={{duration:.6}}>
            <div className="card-topline"><span className="mini-label">YOUR ESCAPE STARTS HERE</span><span className="line-icon"><CalendarDays size={18}/></span></div>
            <h2>Find your <em>moment.</em></h2><p className="card-subtext">See which rooms could be yours.</p>
            <form onSubmit={submitStay}>
              <div className="date-grid"><label><span>CHECK IN</span><input name="checkIn" type="date" value={checkIn} min={tomorrow()} onChange={(event) => { setCheckIn(event.target.value); if (checkOut && event.target.value >= checkOut) setCheckOut(''); }} required/></label><label><span>CHECK OUT</span><input name="checkOut" type="date" value={checkOut} min={checkIn || tomorrow(1)} onChange={(event) => setCheckOut(event.target.value)} required/></label></div>
              <div className="guest-row"><div><span className="field-label">GUESTS</span><strong>{guests} {guests === 1 ? 'guest' : 'guests'}</strong></div><div className="stepper"><button type="button" aria-label="Remove a guest" disabled={guests <= 1} onClick={() => setGuests(Math.max(1,guests-1))}><Minus size={16}/></button><span>{guests}</span><button type="button" aria-label="Add a guest" disabled={guests >= 4} onClick={() => setGuests(Math.min(4,guests+1))}><Plus size={16}/></button></div></div>
              <details className="room-preferences" open={Boolean(nightlyBudget)||roomView!=='any'||breakfastIncluded}><summary>Room preferences <span>· optional</span></summary><div className="preference-fields"><label>Room category<select value={roomId||''} onChange={event=>setRoomId(event.target.value||null)}><option value="">Any matching room</option><option value="classic">Classic Room</option><option value="sea-view">Sea View Room</option><option value="terrace">Terrace Suite</option><option value="horizon">Horizon Suite</option></select></label><label>Maximum nightly rate (€)<input name="nightlyBudget" type="number" min="1" max="10000" step="0.01" inputMode="decimal" placeholder="Any budget" value={nightlyBudget} onChange={event=>setNightlyBudget(event.target.value)}/></label><label>View or outdoor space<select name="roomView" value={roomView} onChange={event=>setRoomView(event.target.value)}><option value="any">Any outlook</option><option value="sea">Sea view</option><option value="terrace">Private or panoramic terrace</option></select></label><label className="breakfast-option"><input type="checkbox" checked={breakfastIncluded} onChange={event=>setBreakfastIncluded(event.target.checked)}/> Breakfast included in the room rate</label></div></details>
              <button className="availability-button" type="submit" disabled={loading}>Compare available rooms <ArrowRight size={17}/></button>
            </form>
            <div className="stay-footnote"><ShieldCheck size={14}/> Sample inventory · No reservation is made</div>
            {error && <div className="form-error" role="alert">{error}</div>}
          </motion.div>

          <motion.div className="explore-card" initial={reduceMotion ? false : {opacity:0,y:22}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.55,delay:.1}}>
            <div className="explore-head"><div><span className="mini-label">CURIOUS ABOUT SOMETHING?</span><h3>Start exploring</h3></div><Compass size={20}/></div>
            <div className="suggestion-list">{suggestions.map(({label,icon:Icon,question},index) => <button key={label} type="button" onClick={() => askSuggestion(question)}><span className="suggestion-icon"><Icon size={17}/></span><span>{label}</span><ArrowUpRight size={16} className="suggestion-arrow"/></button>)}</div>
          </motion.div>
          <div className="trust-note"><span className="trust-icon"><CircleHelp size={18}/></span><p><strong>About this demo</strong><br/>Answers come from a fictional hotel guide. Availability is illustrative; no reservation is made.</p></div>
        </aside>

        <section className="chat-card" id="conversation" aria-label="Simplotel concierge chat">
          <div className="chat-header"><div className="chat-persona"><button id="history-trigger" type="button" className="history-trigger" aria-label={historyOpen ? 'Close conversation sidebar' : 'Open conversation sidebar'} aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}><MessageSquareText size={20}/></button><span className="chat-avatar"><img src="/concierge-mark.webp" alt="" width="48" height="52"/></span><div><span className="mini-label">SIMPLOTEL GUEST CONCIERGE</span><h2>Your concierge</h2><span className="online-label"><i/> Demo · Fictional hotel & sample rates</span></div></div><div className="chat-header-actions"><button type="button" className="tour-button" onClick={startTour} aria-label="Replay guide" title="Replay guide"><HelpCircle size={16}/><span>Guide</span></button><button type="button" className="mobile-stay-button" onClick={() => setPlannerOpen(true)}><CalendarDays size={16}/> Check dates</button><button type="button" className="sound-button" aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'} title={soundEnabled ? 'Sound on' : 'Sound off'} aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button></div></div>
          <div className="chat-divider"><span>{sessions.find((session) => session.id === activeId)?.title || 'YOUR CONVERSATION'}</span><div className="chat-context"><button type="button" className="mobile-guide-button" onClick={startTour} aria-label="Replay guide"><HelpCircle size={14}/> Guide</button><button type="button" className="hotel-contact-trigger" onClick={()=>setContactOpen(true)}>Hotel & contact <ArrowUpRight size={12}/></button><span className="private-label"><ShieldCheck size={13}/> {storageError ? 'Saving unavailable' : 'Saved on this device'}</span></div></div>
          <div ref={conversationRef} className={`conversation ${messages.length === 1 ? 'is-empty' : ''}`} role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text">
            {messages.length > 1 && messages.map((message) => <Message key={message.id} message={message} reduceMotion={reduceMotion} onReview={setReviewSelection} onEditStay={editStay} onContact={()=>setContactOpen(true)} retry={() => sendQuestion(message.retryQuestion || messages.filter((item) => item.role === 'user').at(-1)?.content || '')}/>)}
            {messages.length === 1 && <div className="concierge-welcome">
              <div className="welcome-copy"><span className="welcome-kicker"><i/> THE COVE HOTEL · AMALFI COAST</span><h3>A little curiosity.<br/><em>A better stay.</em></h3><p>Tell me your dates, guests, and preferences.<br className="desktop-break"/> I’ll compare sample rooms and prepare your stay.</p>
                <div className="welcome-actions"><button type="button" onClick={() => askSuggestion('Which room is suitable for three guests?')}><span className="welcome-action-icon"><Sun size={20}/></span><span><strong>Find the right room</strong><small>A little space for everyone</small></span><ArrowUpRight size={17}/></button><button type="button" onClick={() => askSuggestion('Is breakfast included?')}><span className="welcome-action-icon"><Waves size={20}/></span><span><strong>Explore the details</strong><small>Dining, amenities, and more</small></span><ArrowUpRight size={17}/></button><button type="button" onClick={() => askSuggestion('Plan my stay')}><span className="welcome-action-icon"><CalendarDays size={20}/></span><span><strong>Plan my stay for me</strong><small>Tell me once. Review the result.</small></span><ArrowUpRight size={17}/></button></div>
                <span className="welcome-note"><ShieldCheck size={13}/> Fictional hotel, sample rates. No bookings or payments.</span>
              </div>
              <div className="welcome-visual"><img src="/terrace-suite.png" alt="Sunlit terrace suite overlooking the Amalfi Coast"/><div className="welcome-photo-label"><span>A PLACE TO SLOW DOWN</span><p>Consider every<br/><em>moment yours.</em></p></div><span className="welcome-seal" aria-hidden="true"><Waves size={29}/></span></div>
            </div>}
            <AnimatePresence>{loading && <motion.div className="message-row assistant" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}><div className="avatar"><img src="/concierge-mark.webp" alt="" width="24" height="26"/></div><div className="message-body"><div className="message-author">Simplotel concierge</div><div className="typing-indicator" role="status" aria-label="Simplotel is thinking"><span/><span/><span/></div></div></motion.div>}</AnimatePresence>
            <div ref={chatEnd}/>
          </div>
          <div className="chat-bottom"><div className="prompt-row"><span>TRY ASKING</span><button type="button" onClick={() => askSuggestion('Does the hotel have a swimming pool?')}>The pool <ArrowUpRight size={13}/></button><button type="button" onClick={() => askSuggestion('Is breakfast included?')}>Breakfast <ArrowUpRight size={13}/></button><button type="button" onClick={() => askSuggestion('Does the parking fee include electric vehicle charging?')}>EV & parking <ArrowUpRight size={13}/></button><button type="button" onClick={() => askSuggestion('Which room is suitable for three guests?')}>Family rooms <ArrowUpRight size={13}/></button></div>
            <form className="composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(question); }}><label className="sr-only" htmlFor="question">Ask Simplotel a question</label><textarea ref={questionRef} id="question" placeholder="What would make your stay perfect?" value={question} maxLength={600} rows={1} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(pointer:fine)').matches) {event.preventDefault(); sendQuestion(question);} }} disabled={loading}/>{loading ? <button type="button" onClick={() => requestRef.current?.abort()} aria-label="Stop response"><Square size={16}/></button> : <button type="submit" disabled={!question.trim()} aria-label="Send question"><Send size={18}/></button>}</form>
            <div className="composer-footer"><span><ShieldCheck size={12}/> Demo only · Sample data · No reservations</span><span>{question.length > 500 ? `${question.length}/600` : 'Enter to send · Shift + Enter for a new line'}</span></div>
            {error && <div className="form-error" role="alert">{error}</div>}
          </div>
        </section>
      </div>
    </main>
    {sessionReady && <SessionDrawer open={historyOpen} close={() => setHistoryOpen(false)} sessions={sessions} folders={folders} activeId={activeId} busy={loading} newSession={newSession} selectSession={selectSession} renameSession={renameSession} archiveSession={archiveSession} deleteSession={deleteSession} moveSession={moveSession} addFolder={addFolder} renameFolder={renameFolder} deleteFolder={deleteFolder} startTour={startTour}/>}
    {contactOpen&&<HotelContact hotel={hotel} onClose={()=>setContactOpen(false)} onExplore={()=>{setContactOpen(false);goToScene(2);}}/>}
    {reviewSelection&&<StayReview selection={reviewSelection} onClose={()=>setReviewSelection(null)}/>}
  </div>;
}
