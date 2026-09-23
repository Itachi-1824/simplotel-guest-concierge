import {matchRooms,normalizePreferences} from './room-preferences.mjs';
import {checkAvailability, hotel, validateStay} from './assistant.mjs';

export function createQuote(input, now=new Date()) {
  if(!input || typeof input!=='object' || Array.isArray(input)) return {ok:false,status:400,error:'Send room and stay details.'};
  if(typeof input.roomId!=='string' || !hotel.rooms.some(room=>room.id===input.roomId)) return {ok:false,status:400,error:'Choose a valid room category.'};
  const stay=validateStay(input.stay,now);
  if(!stay.ok) return {ok:false,status:400,error:stay.error||'Choose dates and the number of guests first.'};
  let preferences;
  try{preferences=normalizePreferences(input.preferences);}catch(error){return {ok:false,status:400,error:error.message};}
  const available=checkAvailability(stay);
  const matching=matchRooms(available.rooms,preferences);
  const room=matching.find(item=>item.id===input.roomId);
  if(!room) return {ok:false,status:409,error:'This room does not fit your preferences or guest count, or is unavailable in the sample inventory. Please search again.'};
  const report={categoriesChecked:hotel.rooms.length,availableCategories:available.rooms.length,matchingCategories:matching.length,preferences,selectionReason:preferences.roomId?'You requested this room category.':room.id===matching[0]?.id?'Lowest sample nightly rate among the rooms matching your dates, guests, and preferences.':'You selected this room from the matching options.',alternatives:matching.filter(item=>item.id!==room.id).map(({id,name,basePrice,total,view})=>({id,name,basePrice,total,view})),steps:[`Checked ${hotel.rooms.length} room categories for ${stay.nights} nights and ${stay.adults} guests.`,`Found ${available.rooms.length} available categories; ${matching.length} matched your preferences.`,`Calculated €${room.basePrice} × ${stay.nights} nights = €${room.total}.`],scope:'The Cove Hotel sample inventory only. No external sites searched; no room held or payment initiated.'};
  return {ok:true,quote:{demo:true,paymentEnabled:false,report,property:hotel.hotel.name,checkIn:stay.checkIn,checkOut:stay.checkOut,guests:stay.adults,nights:stay.nights,currency:hotel.hotel.currency,room,subtotal:room.total,quotedAt:now.toISOString(),expiresAt:new Date(now.getTime()+15*60_000).toISOString(),taxes:'Not supplied in this demo; confirm taxes and fees with the booking provider.',cancellation:hotel.facts.find(fact=>fact.id==='cancellation').answer,notice:'Sample quote only. No room is held, no reservation is made, and no payment is collected.'}};
}
