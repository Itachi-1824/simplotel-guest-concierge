import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, CircleHelp, Clock3, Copy, HelpCircle, Home, Menu, MessageSquareText, Minus, Moon, Plus, RotateCcw, Send, ShieldCheck, Sparkles, Square, Sun, Volume2, VolumeX, Waves, X } from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import SessionDrawer from './SessionDrawer.jsx';
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
const initialMessage = { id:0, role:'assistant', content:'Welcome to the Simplotel Guest Concierge. I can help you explore The Cove Hotel, compare rooms, answer stay questions, or check sample availability. Where shall we start?', type:'welcome' };
const tomorrow = (offset = 0) => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0,10); };


function useSound() {
  const [enabled, setEnabled] = useState(false);
  const context = useRef(null);
  const play = (type = 'send') => {
    if (!enabled) return;
    try {
      context.current ||= new (window.AudioContext || window.webkitAudioContext)();
      const audio = context.current;
      if (audio.state === 'suspended') audio.resume();
      const notes = type === 'receive' ? [523.25, 659.25] : [392, 493.88];
      notes.forEach((frequency, index) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, audio.currentTime + index * .07);
        gain.gain.exponentialRampToValueAtTime(.035, audio.currentTime + index * .07 + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + index * .07 + .23);
        osc.connect(gain).connect(audio.destination);
        osc.start(audio.currentTime + index * .07);
        osc.stop(audio.currentTime + index * .07 + .24);
      });
    } catch {  }
  };
  return { enabled, setEnabled, play };
}

function RoomCard({ room, index, reduceMotion }) {
  return <motion.div className="room-card" initial={reduceMotion ? false : { opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:index * .08 }}>
    <div className="room-symbol">{room.id === 'classic' ? <Sun size={20}/> : room.id === 'sea-view' ? <Waves size={20}/> : room.id === 'terrace' ? <Moon size={20}/> : <Sparkles size={20}/>}</div>
    <div className="room-copy"><div className="room-name">{room.name}</div><div className="room-description">{room.description}</div><div className="room-meta">Up to {room.capacity} guests <span>·</span> {room.available} left in sample inventory</div></div>
    <div className="room-rate"><strong>€{room.total.toLocaleString()}</strong><span>total · {room.basePrice}/night</span></div>
  </motion.div>;
}

function Message({ message, reduceMotion, retry }) {
  const isGuest = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false),2000); } catch { setCopied(false); } };
  return <motion.div className={`message-row ${isGuest ? 'guest' : 'assistant'}`} initial={reduceMotion ? false : {opacity:0, y:14, scale:.985}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.34, ease:[.22,1,.36,1]}}>
    {!isGuest && <div className="avatar" aria-hidden="true"><Sparkles size={15}/></div>}
    <div className="message-body">
      <div className="message-author">{isGuest ? 'You' : 'Simplotel concierge'} {message.createdAt && <span>· {new Date(message.createdAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span>}</div>
      <div className={`bubble ${message.type === 'error' ? 'error-bubble' : ''}`}>{message.content}</div>
      {message.sources?.length > 0 && <div className="source-line"><ShieldCheck size={13}/> Based on hotel information: {message.sources.map((source) => source.topic).filter((item,index,array) => array.indexOf(item) === index).join(', ')}</div>}
      {message.availability && <div className="availability-result">
        <div className="result-heading"><CalendarDays size={15}/> {new Date(`${message.availability.checkIn}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {new Date(`${message.availability.checkOut}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} <span>· {message.availability.adults} {message.availability.adults === 1 ? 'guest' : 'guests'}</span></div>
        {message.availability.rooms.length ? message.availability.rooms.map((room,index) => <RoomCard key={room.id} room={room} index={index} reduceMotion={reduceMotion}/>) : <div className="no-rooms">Try another date range or guest count.</div>}
        <p className="inventory-note">Illustrative rates and inventory · No reservation is made</p>
      </div>}
      {!isGuest && message.type !== 'welcome' && <div className="message-actions"><button type="button" onClick={copy} aria-label={copied ? 'Answer copied' : 'Copy answer'}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? 'Copied' : 'Copy'}</button>{message.type === 'error' && <button type="button" onClick={retry}><RotateCcw size={13}/> Try again</button>}</div>}
    </div>
  </motion.div>;
}

export default function GuestExperience() {
  const reduceMotion = useReducedMotion();
  const { enabled:soundEnabled, setEnabled:setSoundEnabled, play } = useSound();
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
    tourRef.current?.destroy();
    setPlannerOpen(false); setHistoryOpen(false);
    goToScene(1,true);
    window.setTimeout(() => {
      const tour = driver({animate:!reduceMotion,popoverClass:'simplotel-tour',showProgress:true,progressText:'{{current}} of {{total}}',nextBtnText:'Next',prevBtnText:'Back',doneBtnText:'Start exploring',overlayColor:'#153b3b',overlayOpacity:.62,allowClose:true,onDestroyed:() => setHistoryOpen(false),steps:[
        {element:'#conversation .chat-persona',popover:{title:'Your guest concierge',description:'Ask about rooms, amenities, dining, policies, or a possible stay. Answers come from the hotel guide.'}},
        {element:'#question',popover:{title:'Ask in your own words',description:'Type a question here. You can ask a follow-up, and the concierge will keep the context of this conversation.'}},
        {element:'.prompt-row',popover:{title:'Need a place to start?',description:'These quick questions give you an easy first step. You can always type something different.'}},
        {element:'.mobile-stay-button',popover:{title:'Check your dates',description:'Pick check-in, check-out, and guests to see illustrative room availability. This demo does not make a reservation.'}},
        {element:'#history-trigger',popover:{title:'Save your plans',description:'Your chats are saved on this device. Open here to rename, archive, delete, or organize them.',onNextClick:(_element,_step,{driver:activeTour}) => { setHistoryOpen(true); window.setTimeout(() => activeTour.moveNext(),400); }}},
        {element:'#tour-folders',waitForElement:1200,popover:{title:'Folders for places',description:'Create a folder named after a city or country, such as Italy. Move related conversations into it so your travel plans stay together.',onPrevClick:(_element,_step,{driver:activeTour}) => { setHistoryOpen(false); window.setTimeout(() => activeTour.movePrevious(),400); }}},
        {element:'#tour-new-chat',popover:{title:'Begin another conversation',description:'Start fresh whenever you like. Return to any saved chat from this panel, and replay this guide from its footer.'}}
      ]});
      tourRef.current = tour; tour.drive();
    }, reduceMotion ? 40 : 600);
  };
  useEffect(() => { if (!sessionReady) return; try { if (localStorage.getItem(TOUR_KEY)) return; localStorage.setItem(TOUR_KEY,'seen'); } catch { return; } const timer = window.setTimeout(startTour,1500); return () => clearTimeout(timer); }, [sessionReady]);
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
    const onScroll = () => { if (!locked) activeSceneRef.current = Math.max(0,Math.min(2,Math.round(scroller.scrollTop / scroller.clientHeight))); };
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
      scenes[next].scrollIntoView({behavior:reduceMotion ? 'instant' : 'smooth',block:'start'});
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

  const sendQuestion = async (text, stay) => {
    const value = text.trim();
    if (!value || loading) return;
    setError(''); setLoading(true); setQuestion(''); play('send');
    const history = messages.filter((message) => message.id !== 0).map(({role,content}) => ({role,content})).slice(-8);
    const guestMessage = {id:Date.now(),role:'user',content:value,createdAt:new Date().toISOString()};
    setMessages((previous) => [...previous, guestMessage]);
    try {
      requestRef.current = new AbortController();
      const response = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, signal:requestRef.current.signal, body:JSON.stringify({question:value,history, ...(stay ? {stay} : {})}) });
      let result;
      try { result = await response.json(); } catch { throw new Error('We could not read the response. Please try again.'); }
      if (!response.ok) throw new Error(result.error || 'The concierge is unavailable right now.');
      setMessages((previous) => [...previous, {id:Date.now()+1,role:'assistant',content:result.answer,type:result.type,sources:result.sources,availability:result.availability,createdAt:new Date().toISOString()}]);
      if (result.type === 'availability-needed') setPlannerOpen(true);
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
    sendQuestion(`Check availability for ${guests} ${guests === 1 ? 'guest' : 'guests'} from ${selectedCheckIn} to ${selectedCheckOut}`, {checkIn:selectedCheckIn,checkOut:selectedCheckOut,adults:guests});
    goToScene(1);
  };

  const askSuggestion = (text) => { sendQuestion(text); setPlannerOpen(false); goToScene(1); };
  return <div className="app-shell">
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
              <button className="availability-button" type="submit" disabled={loading}>Check availability <ArrowRight size={17}/></button>
            </form>
            <div className="stay-footnote"><ShieldCheck size={14}/> Sample inventory · No booking required</div>
            {error && <div className="form-error" role="alert">{error}</div>}
          </motion.div>

          <motion.div className="explore-card" initial={reduceMotion ? false : {opacity:0,y:22}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.55,delay:.1}}>
            <div className="explore-head"><div><span className="mini-label">CURIOUS ABOUT SOMETHING?</span><h3>Start exploring</h3></div><Sparkles size={20}/></div>
            <div className="suggestion-list">{suggestions.map(({label,icon:Icon,question},index) => <button key={label} type="button" onClick={() => askSuggestion(question)}><span className="suggestion-icon"><Icon size={17}/></span><span>{label}</span><ArrowUpRight size={16} className="suggestion-arrow"/></button>)}</div>
          </motion.div>
          <div className="trust-note"><span className="trust-icon"><CircleHelp size={18}/></span><p><strong>About this demo</strong><br/>Answers come from a fictional hotel guide. Availability is illustrative; no reservation is made.</p></div>
        </aside>

        <section className="chat-card" id="conversation" aria-label="Simplotel concierge chat">
          <div className="chat-header"><div className="chat-persona"><button id="history-trigger" type="button" className="history-trigger" aria-label={historyOpen ? 'Close conversation sidebar' : 'Open conversation sidebar'} aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}><MessageSquareText size={20}/></button><span className="chat-avatar"><Sparkles size={21}/><i/></span><div><span className="mini-label">SIMPLOTEL GUEST CONCIERGE</span><h2>Your concierge</h2><span className="online-label"><i/> Here to help, whenever you need</span></div></div><div className="chat-header-actions"><button type="button" className="tour-button" onClick={startTour} aria-label="Replay guide" title="Replay guide"><HelpCircle size={18}/></button><button type="button" className="mobile-stay-button" onClick={() => setPlannerOpen(true)}><CalendarDays size={16}/> Check dates</button><button type="button" className="sound-button" aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'} title={soundEnabled ? 'Sound on' : 'Sound off'} onClick={() => setSoundEnabled(!soundEnabled)}>{soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button></div></div>
          <div className="chat-divider"><span>{sessions.find((session) => session.id === activeId)?.title || 'YOUR CONVERSATION'}</span><div className="chat-context"><a href="#discover" onClick={(event) => {event.preventDefault();goToScene(2);}}>The Cove Hotel <ArrowUpRight size={12}/></a><span className="private-label"><ShieldCheck size={13}/> {storageError ? 'Saving unavailable' : 'Saved on this device'}</span></div></div>
          <div ref={conversationRef} className={`conversation ${messages.length === 1 ? 'is-empty' : ''}`} role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text">
            {messages.length > 1 && messages.map((message) => <Message key={message.id} message={message} reduceMotion={reduceMotion} retry={() => sendQuestion(message.retryQuestion || messages.filter((item) => item.role === 'user').at(-1)?.content || '')}/>)}
            {messages.length === 1 && <div className="concierge-welcome">
              <div className="welcome-copy"><span className="welcome-kicker"><i/> THE COVE HOTEL · AMALFI COAST</span><h3>A little curiosity.<br/><em>A better stay.</em></h3><p>Your room, your plans, your little questions.<br className="desktop-break"/> Let’s make every detail feel easy.</p>
                <div className="welcome-actions"><button type="button" onClick={() => askSuggestion('Which room is suitable for three guests?')}><span className="welcome-action-icon"><Sun size={20}/></span><span><strong>Find the right room</strong><small>A little space for everyone</small></span><ArrowUpRight size={17}/></button><button type="button" onClick={() => askSuggestion('Is breakfast included?')}><span className="welcome-action-icon"><Waves size={20}/></span><span><strong>Explore the details</strong><small>Dining, amenities, and more</small></span><ArrowUpRight size={17}/></button><button type="button" onClick={() => setPlannerOpen(true)}><span className="welcome-action-icon"><CalendarDays size={20}/></span><span><strong>Plan a possible stay</strong><small>Dates, guests, and available rooms</small></span><ArrowUpRight size={17}/></button></div>
                <span className="welcome-note"><ShieldCheck size={13}/> Answers grounded in the hotel guide.</span>
              </div>
              <div className="welcome-visual"><img src="/terrace-suite.png" alt="Sunlit terrace suite overlooking the Amalfi Coast"/><div className="welcome-photo-label"><span>A PLACE TO SLOW DOWN</span><p>Consider every<br/><em>moment yours.</em></p></div><span className="welcome-seal" aria-hidden="true"><Waves size={29}/></span></div>
            </div>}
            <AnimatePresence>{loading && <motion.div className="message-row assistant" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}><div className="avatar"><Sparkles size={15}/></div><div className="message-body"><div className="message-author">Simplotel concierge</div><div className="typing-indicator" role="status" aria-label="Simplotel is thinking"><span/><span/><span/></div></div></motion.div>}</AnimatePresence>
            <div ref={chatEnd}/>
          </div>
          <div className="chat-bottom"><div className="prompt-row"><span>TRY ASKING</span><button type="button" onClick={() => askSuggestion('Does the hotel have a swimming pool?')}>The pool <ArrowUpRight size={13}/></button><button type="button" onClick={() => askSuggestion('Is breakfast included?')}>Breakfast <ArrowUpRight size={13}/></button><button type="button" onClick={() => askSuggestion('Which room is suitable for three guests?')}>Family rooms <ArrowUpRight size={13}/></button></div>
            <form className="composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(question); }}><label className="sr-only" htmlFor="question">Ask Simplotel a question</label><textarea ref={questionRef} id="question" placeholder="What would make your stay perfect?" value={question} maxLength={600} rows={1} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(pointer:fine)').matches) {event.preventDefault(); sendQuestion(question);} }} disabled={loading}/>{loading ? <button type="button" onClick={() => requestRef.current?.abort()} aria-label="Stop response"><Square size={16}/></button> : <button type="submit" disabled={!question.trim()} aria-label="Send question"><Send size={18}/></button>}</form>
            <div className="composer-footer"><span><Sparkles size={12}/> A little more help, a lot more ease.</span><span>{question.length > 500 ? `${question.length}/600` : 'Enter to send · Shift + Enter for a new line'}</span></div>
            {error && <div className="form-error" role="alert">{error}</div>}
          </div>
        </section>
      </div>
    </main>
    {sessionReady && <SessionDrawer open={historyOpen} close={() => setHistoryOpen(false)} sessions={sessions} folders={folders} activeId={activeId} busy={loading} newSession={newSession} selectSession={selectSession} renameSession={renameSession} archiveSession={archiveSession} deleteSession={deleteSession} moveSession={moveSession} addFolder={addFolder} renameFolder={renameFolder} deleteFolder={deleteFolder} startTour={startTour}/>}
  </div>;
}
