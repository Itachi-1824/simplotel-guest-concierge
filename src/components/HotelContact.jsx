import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,Copy,Mail,MapPin,Phone,ShieldCheck,X} from 'lucide-react';
import '../styles/booking.css';
import '../styles/contact.css';

export default function HotelContact({hotel,onClose,onExplore}) {
  const dialog=useRef(null);
  const [copied,setCopied]=useState('');
  const [error,setError]=useState('');
  const contact=hotel.contact;
  useEffect(()=>{dialog.current.showModal();return()=>dialog.current?.close();},[]);
  const copy=async(key)=>{try{await navigator.clipboard.writeText(contact[key]);setCopied(key);setError('');}catch{setError('Copy is unavailable. Select the contact text to copy it.');}};
  const items=[['phone','Reservations',Phone],['email','Email the front desk',Mail],['address','Address & location',MapPin]];
  return <dialog ref={dialog} className="stay-review contact-dialog" aria-labelledby="hotel-contact-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header className="review-header"><div><span className="review-eyebrow">A HUMAN TOUCH</span><h2 id="hotel-contact-title">Hotel & contact</h2></div><button type="button" onClick={onClose} aria-label="Close hotel contact"><X size={20}/></button></header>
    <div className="review-content"><div className="contact-property"><span>THE COVE HOTEL</span><h3>A little closer<br/>to the coast.</h3><p>{hotel.location}</p></div>
      {contact.demo&&<div className="contact-disclosure"><ShieldCheck size={17}/><p>{contact.notice}</p></div>}
      <div className="contact-list">{items.map(([key,label,Icon])=><section key={key}><Icon size={20}/><div><h3>{label}{contact.demo&&<small>DEMO</small>}</h3><p>{contact[key]}</p>{contact.demo||key==='address'?<button type="button" onClick={()=>copy(key)}>{copied===key?<Check size={13}/>:<Copy size={13}/>} {copied===key?'Copied':`Copy ${contact.demo?'demo ':''}${key==='address'?'address':key}`}</button>:<a href={key==='phone'?`tel:${contact.phone.replace(/[^+\d]/g,'')}`:`mailto:${contact.email}`}>{key==='phone'?'Call hotel':'Send an email'} <ArrowUpRight size={14}/></a>}</div></section>)}</div>
      <a className="contact-map" href={contact.mapUrl} target="_blank" rel="noopener noreferrer"><MapPin size={17}/><span>{contact.mapLabel}<small>{contact.demo?'Area reference only · no hotel pin':'Directions in Google Maps'}</small></span><ArrowUpRight size={17}/></a>
      <p className="contact-copy-status" role="status">{error|| (copied?`Sample ${copied} copied.`:'')}</p>
    </div>
    <footer className="review-footer"><span className="contact-hours">Sample reception · 24 hours</span><button type="button" className="review-primary" onClick={onExplore}>Explore the hotel <ArrowUpRight size={15}/></button></footer>
  </dialog>;
}
