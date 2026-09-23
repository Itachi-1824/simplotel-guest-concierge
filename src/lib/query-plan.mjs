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
  ['transport', /\b(airport|transfer|shuttle)\b/i]
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

export function resolveStay(question, history = [], inputStay = {}) {
  const parse = (text) => {
    const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
    const people = text.match(/\b(\d+|one|two|three|four)\s*(?:adults?|guests?|people|persons?)\b/i);
    const numbers = {one:1,two:2,three:3,four:4};
    return { ...(dates[0] ? {checkIn:dates[0]} : {}), ...(dates[1] ? {checkOut:dates[1]} : {}), ...(people ? {adults:numbers[people[1].toLowerCase()] || Number(people[1])} : {}) };
  };
  const recent = history.filter((turn) => turn.role === 'user').slice(-4);
  return Object.assign({}, ...recent.map((turn) => parse(turn.content)), parse(question), inputStay || {});
}
