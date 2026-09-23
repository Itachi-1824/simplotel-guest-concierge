export const SESSION_KEY = 'simplotel.concierge.sessions.v1';
export const TOUR_KEY = 'simplotel.concierge.tour.v1';

export function autoTitle(question) {
  const clean = String(question || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'New conversation';
  return clean.length > 38 ? `${clean.slice(0, 37).trimEnd()}…` : clean;
}

export function exportTranscript(session) {
  const messages = session.messages.map((message) => {
    let text = `## ${message.role === 'user' ? 'You' : 'Simplotel concierge'}\n\n${message.content}`;
    if (message.availability) {
      const stay = message.availability;
      text += `\n\n${stay.checkIn} to ${stay.checkOut} · ${stay.adults} guests · ${stay.nights} nights\n`;
      text += stay.rooms.map((room) => `\n- ${room.name}: €${room.total} total (€${room.basePrice}/night), up to ${room.capacity} guests; ${room.available} left in sample inventory.`).join('');
      text += '\n\nIllustrative availability. No reservation is made.';
    }
    if (message.sources?.length) text += `\n\nSources: ${[...new Set(message.sources.map((source) => source.topic))].join(', ')}.`;
    return text;
  });
  return `# ${session.title}\n\n${messages.join('\n\n')}\n`;
}

export function createSession(welcome, id = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`) {
  const time = new Date().toISOString();
  return { id, title:'New conversation', folderId:null, archived:false, manualTitle:false, createdAt:time, updatedAt:time, messages:[welcome] };
}

export function createFolder(name, id = globalThis.crypto?.randomUUID?.() || `folder-${Date.now()}`) {
  const title = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 50);
  if (!title) return null;
  return { id, name:title, createdAt:new Date().toISOString() };
}

export function loadSavedSessions(value, welcome) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed?.sessions)) return null;
    const folders = (Array.isArray(parsed.folders) ? parsed.folders : []).slice(0, 30).filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string').map((item) => ({id:item.id,name:item.name.slice(0,50),createdAt:typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString()}));
    const sessions = parsed.sessions.slice(0, 60).filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string' && Array.isArray(item.messages)).map((item) => ({
      id:item.id,
      title:item.title.slice(0,60) || 'New conversation',
      folderId:folders.some((folder) => folder.id === item.folderId) ? item.folderId : null,
      archived:Boolean(item.archived),
      manualTitle:Boolean(item.manualTitle),
      createdAt:typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      updatedAt:typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
      messages:[welcome,...item.messages.filter((message) => message?.id !== 0 && ['user','assistant'].includes(message?.role) && typeof message.content === 'string').slice(-49)]
    }));
    if (!sessions.length) return null;
    const activeId = sessions.some((session) => session.id === parsed.activeId && !session.archived) ? parsed.activeId : sessions.find((session) => !session.archived)?.id;
    return { sessions, folders, activeId };
  } catch { return null; }
}
