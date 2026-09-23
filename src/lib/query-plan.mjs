import * as chrono from 'chrono-node';

export const hotelToday=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);

const rooms = [
  ['classic', /\bclassic\b/i, 'Classic Room'],
  ['sea-view', /\bsea[ -]?view\b/i, 'Sea View Room'],
  ['terrace', /\bterrace\b/i, 'Terrace Suite'],
  ['horizon', /\bhorizon\b/i, 'Horizon Suite']
];
const topics = [
  ['breakfast', /\b(breakfast|morning meal)\b/i],
  ['pool', /\b(pool|swim\w*)\b/i],
  ['arrival', /\b(check[ -]?(?:in|out)|arriv\w*|depart\w*|late checkout)\b/i],
  ['cancellation', /\b(cancel\w*|refund\w*)\b/i],
  ['parking', /\b(park\w*|valet)\b/i],
  ['wifi', /\b(wi[ -]?fi|internet|online)\b/i],
  ['pets', /\b(pets?|dogs?|animals?)\b/i],
  ['accessibility', /\b(accessib\w*|wheelchair|step[ -]free)\b/i],
  ['dining', /\b(dinner|dining|restaurant|supper)\b/i],
  ['transport', /\b(airport|transfer|shuttle)\b/i],
  ['breakfast-hours', /\b(?:breakfast (?:hours|time|box)|when.*breakfast|early breakfast)\b/i],
  ['dietary', /\b(?:allerg\w*|vegan|vegetarian|gluten|dietary)\b/i],
  ['children-dining', /\b(?:children.s (?:dinner|menu)|kids.? menu|child dinner)\b/i],
  ['room-service', /\b(?:room service|in.room dining|delivery charge)\b/i],
  ['luggage', /\b(?:luggage|suitcases?|bag storage)\b/i],
  ['late-arrival', /\b(?:midnight|after 11|late arrival)\b/i],
  ['reception', /\b(?:reception|front desk|night desk)\b/i],
  ['charging', /\b(?:electric (?:vehicle|car)|ev|chargers?|charging)\b/i],
  ['pool-weather', /\b(?:pool.*(?:weather|lightning|storm|close temporarily)|weather.*pool)\b/i],
  ['cot', /\b(?:cot|crib|baby|infant)\b/i],
  ['connecting-rooms', /\b(?:connecting|adjoining)\b/i],
  ['extra-bed', /\b(?:extra bed|rollaway|additional bed)\b/i],
  ['quiet-hours', /\b(?:quiet hours|noise|part(?:y|ies))\b/i],
  ['smoking', /\b(?:smok(?:e|ing)|cigarettes?|vaping)\b/i],
  ['contact', /\b(?:contact|phone|telephone|email|call the hotel)\b/i],
  ['location', /\b(?:address|location|directions|map|street)\b/i]
];

export function planQuery(question, history = []) {
  const previous = history.filter((turn) => turn.role === 'user').slice(-4).map((turn) => turn.content);
  const mentionedRooms = rooms.filter(([,pattern]) => pattern.test(question));
  const followUp = /^(and\b|what about\b|how about\b|is it\b|does it\b|can it\b)|\b(that room|this room|it include|its|that suite)\b/i.test(question.trim());
  const priorRoom = [...previous].reverse().flatMap((text) => rooms.filter(([,pattern]) => pattern.test(text))).at(0);
  const entities = mentionedRooms.length ? mentionedRooms : followUp && priorRoom ? [priorRoom] : [];
  const explicitTopics = topics.filter(([,pattern]) => pattern.test(question)).map(([id]) => id);
  const priorTopic = [...previous].reverse().flatMap((text) => topics.filter(([,pattern]) => pattern.test(text))).at(0)?.[0];
  const focus = explicitTopics.length ? explicitTopics : followUp && priorTopic ? [priorTopic] : [];
  const context = entities.map(([, ,name]) => name).join(' ');
  const query = followUp && context ? `${question} ${context}` : followUp && previous.length ? `${question} ${previous.at(-1)}` : question;
  return { query, followUp, entities:entities.map(([id]) => id), topics:focus, needsClarification:followUp && !previous.length, candidates:[question,query,...focus.map((topic) => `${query} ${topic}`)].filter((item,index,array) => array.indexOf(item) === index) };
}

export function resolveStay(question, history = [], inputStay = {}, now=new Date(), contextStay) {
  const numbers={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  const reference=new Date(`${hotelToday(now)}T12:00:00`);
  const iso=parts=>`${parts.get('year')}-${String(parts.get('month')).padStart(2,'0')}-${String(parts.get('day')).padStart(2,'0')}`;
  const parse = (text,context={}) => {
    let dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
    if(!dates.length&&!/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(text)){
      const calendarText=/\b(?:today|tomorrow|tonight|yesterday|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|days?|weeks?|months?|\d{1,2}(?:st|nd|rd|th))\b/i;
      const parsed=chrono.parse(text.replace(/[–—−]/g,'-'),reference,{forwardDate:true}).filter(item=>(item.start.isCertain('day')||item.start.isCertain('weekday'))&&calendarText.test(item.text));
      dates=parsed.flatMap(item=>[iso(item.start),...(item.end?[iso(item.end)]:[])]);
    }
    const shorthand=text.match(/^\s*(\d{1,2})\s*[-–]\s*(\d{1,2})(?=\s*(?:,|$))/);
    if(!dates.length&&shorthand&&context.checkIn){
      const month=context.checkIn.slice(0,7);
      dates=[`${month}-${shorthand[1].padStart(2,'0')}`,`${month}-${shorthand[2].padStart(2,'0')}`];
    }
    const people = [...text.matchAll(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:adults?|guests?|people|persons?|of us)\b/gi)].filter(match=>!/(?:\bnot|rather than|instead of)\s*$/i.test(text.slice(0,match.index))).at(-1)
      ||text.match(/\bfor\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?=\s+(?:from|on|arriving|checking|with|under|please|thanks|not|instead|in\s+(?:a|the)\b)|\s*[,.!?;]|\s*$)/i)
      ||(shorthand?text.match(/,\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:please)?\s*[.!?]*$/i):null)
      ||text.trim().match(/^(?:(?:actually|just|only|make it|we are|we're|sorry)[,\s]+)*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+(?:please|not\s+(?:\d+|one|two|three|four)))?\s*[.!?]*$/i);
    const duration=text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a)\s+nights?\b/i);
    const checkoutOnly=/\b(?:check[ -]?out|depart|leave|leaving|until)\b/i.test(text)&&!/(?:check[ -]?in|arriv|from)/i.test(text)&&dates.length===1;
    return { ...(dates[0] ? {[checkoutOnly?'checkOut':'checkIn']:dates[0]} : {}), ...(dates[1] ? {checkOut:dates[1]} : {}), ...(people ? {adults:numbers[people[1].toLowerCase()] || Number(people[1])} : /\b(?:my (?:partner|wife|husband) and (?:I|me)|(?:I|me) and my (?:partner|wife|husband)|for a couple|just me|travelling alone)\b/i.test(text)?{adults:/just me|travelling alone/i.test(text)?1:2}:{}),...(duration?{duration:duration[1].toLowerCase()==='a'?1:numbers[duration[1].toLowerCase()]||Number(duration[1])}:{}) };
  };
  const recent = contextStay ? [] : history.filter((turn) => turn.role === 'user').slice(-4);
  const resolved={...contextStay};
  for(const value of [...recent.map(turn=>turn.content),question,inputStay||{}]){
    const part=typeof value==='string'?parse(value,resolved):value;
    if(part.checkOut)delete resolved.duration;
    if(part.duration)delete resolved.checkOut;
    Object.assign(resolved,part);
  }
  if(resolved.checkIn&&resolved.duration&&!resolved.checkOut){
    const departure=new Date(`${resolved.checkIn}T12:00:00Z`);
    if(!Number.isNaN(departure.getTime())){departure.setUTCDate(departure.getUTCDate()+resolved.duration);resolved.checkOut=departure.toISOString().slice(0,10);}
  }
  delete resolved.duration;
  return resolved;
}
