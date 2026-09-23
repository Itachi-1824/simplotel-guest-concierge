import React, { useState } from 'react';
import { Archive, ArchiveRestore, ChevronDown, Download, Folder, FolderPlus, MessageSquarePlus, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { exportTranscript } from '../lib/sessions.mjs';

export default function SessionDrawer({ open, close, sessions, folders, activeId, busy, newSession, selectSession, renameSession, archiveSession, deleteSession, moveSession, addFolder, renameFolder, deleteFolder, startTour }) {
  const [view, setView] = useState('all');
  const [folderName, setFolderName] = useState('');
  const [makingFolder, setMakingFolder] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');
  const [folderError, setFolderError] = useState('');
  const matches = (session) => `${session.title} ${session.messages.map((message) => message.content).join(' ')}`.toLowerCase().includes(search.toLowerCase().trim());
  const exportSession = (session) => {
    const text = exportTranscript(session);
    const url = URL.createObjectURL(new Blob([text], {type:'text/markdown;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = `${session.title.replace(/[^a-z0-9]+/gi,'-').slice(0,50) || 'conversation'}.md`; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  const beginEdit = (type, id, value) => { setEditing(`${type}:${id}`); setEditValue(value); setConfirming(null); };
  const finishEdit = (type, id) => { const clean = editValue.trim(); if (clean) (type === 'folder' ? renameFolder : renameSession)(id, clean); setEditing(null); };
  const renderSession = (session) => <div className={`session-item ${activeId === session.id ? 'active' : ''}`} key={session.id}>
    {editing === `session:${session.id}` ? <form className="session-rename" onSubmit={(event) => { event.preventDefault(); finishEdit('session', session.id); }}><input autoFocus value={editValue} maxLength={60} onChange={(event) => setEditValue(event.target.value)} aria-label="Conversation name"/><button type="submit">Save</button></form> : <button className="session-select" type="button" disabled={busy || session.archived} onClick={() => { selectSession(session.id); close(); }}><span>{session.title}</span><small>{new Date(session.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></button>}
    {confirming === `session:${session.id}` ? <div className="session-confirm"><span>Delete?</span><button type="button" onClick={() => { deleteSession(session.id); setConfirming(null); }}>Yes</button><button type="button" onClick={() => setConfirming(null)}>No</button></div> : <div className="session-controls">
      <button type="button" aria-label={`Export ${session.title}`} title="Download conversation" onClick={() => exportSession(session)}><Download size={14}/></button>
      <button type="button" aria-label={`Rename ${session.title}`} title="Rename" onClick={() => beginEdit('session',session.id,session.title)}><Pencil size={13}/></button>
      <button type="button" aria-label={session.archived ? `Restore ${session.title}` : `Archive ${session.title}`} title={session.archived ? 'Restore' : 'Archive'} onClick={() => archiveSession(session.id)}>{session.archived ? <ArchiveRestore size={14}/> : <Archive size={14}/>}</button>
      <button type="button" aria-label={`Delete ${session.title}`} title="Delete" onClick={() => setConfirming(`session:${session.id}`)}><Trash2 size={14}/></button>
    </div>}
    {!session.archived && folders.length > 0 && <select className="session-folder-select" value={session.folderId || ''} onChange={(event) => moveSession(session.id,event.target.value || null)} aria-label={`Move ${session.title} to folder`}><option value="">Unfiled</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select>}
  </div>;
  const unfiled = sessions.filter((session) => !session.archived && !session.folderId && matches(session)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  const archived = sessions.filter((session) => session.archived && matches(session)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  return <>
    {open && <button className="history-overlay" aria-label="Close conversation history" type="button" onClick={close}/>}
    <aside className={`history-drawer ${open ? 'open' : ''}`} role="dialog" aria-modal={open || undefined} aria-label="Conversation history" aria-hidden={!open} inert={!open}>
      <div className="history-head"><div><span className="mini-label">YOUR STAYS, IN ONE PLACE</span><h2>Conversations</h2></div><button type="button" className="history-close" onClick={close} aria-label="Close history"><X size={20}/></button></div>
      <div className="history-primary"><button id="tour-new-chat" type="button" onClick={() => { newSession(); close(); }} disabled={busy}><MessageSquarePlus size={18}/> New conversation <Plus size={16}/></button></div>
      <label className="history-search"><Search size={16}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a conversation…" aria-label="Search conversations"/></label>
      <div className="history-tabs"><button type="button" className={view === 'all' ? 'selected' : ''} onClick={() => setView('all')}>All chats</button><button type="button" className={view === 'archived' ? 'selected' : ''} onClick={() => setView('archived')}>Archived</button></div>
      <div className="history-list" id="tour-folders">
        {view === 'all' ? <>
          <div className="history-section-label"><span>YOUR FOLDERS</span><button type="button" onClick={() => setMakingFolder(!makingFolder)} aria-label="Create folder"><FolderPlus size={17}/> Add</button></div>
          {makingFolder && <form className="folder-create" onSubmit={(event) => { event.preventDefault(); if (addFolder(folderName)) { setFolderName(''); setMakingFolder(false); setFolderError(''); } else setFolderError('That folder already exists. Choose another name.'); }}><input autoFocus value={folderName} onChange={(event) => {setFolderName(event.target.value);setFolderError('');}} maxLength={50} placeholder="City or country, e.g. Italy" aria-label="New folder name"/><button type="submit" disabled={!folderName.trim()}>Create</button></form>}
          {folderError && <p className="form-error" role="alert">{folderError}</p>}
          {folders.length === 0 && <p className="history-hint">Create a folder for a city or country. Your chats stay easy to find as you plan.</p>}
          {folders.map((folder) => { const items = sessions.filter((session) => !session.archived && session.folderId === folder.id && matches(session)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); return <div className="folder-group" key={folder.id}>
            <div className="folder-heading"><button type="button" onClick={() => setExpanded((old) => ({...old,[folder.id]:old[folder.id] === false}))} aria-expanded={expanded[folder.id] !== false}><Folder size={16}/><span>{folder.name}</span><small>{items.length}</small><ChevronDown size={15} className={expanded[folder.id] === false ? 'folded' : ''}/></button><button type="button" title="Rename folder" aria-label={`Rename ${folder.name}`} onClick={() => beginEdit('folder',folder.id,folder.name)}><Pencil size={13}/></button><button type="button" title="Delete folder" aria-label={`Delete ${folder.name}`} onClick={() => setConfirming(`folder:${folder.id}`)}><Trash2 size={13}/></button></div>
            {editing === `folder:${folder.id}` && <form className="session-rename" onSubmit={(event) => { event.preventDefault(); finishEdit('folder',folder.id); }}><input autoFocus value={editValue} maxLength={50} onChange={(event) => setEditValue(event.target.value)} aria-label="Folder name"/><button type="submit">Save</button></form>}
            {confirming === `folder:${folder.id}` && <div className="folder-confirm">Chats will move to Unfiled. Delete folder? <button type="button" onClick={() => { deleteFolder(folder.id); setConfirming(null); }}>Delete</button><button type="button" onClick={() => setConfirming(null)}>Cancel</button></div>}
            {expanded[folder.id] !== false && <div className="folder-contents">{items.length ? items.map(renderSession) : <p>No conversations yet. Move one here with its folder menu.</p>}</div>}
          </div>; })}
          <div className="history-section-label"><span>UNFILED CHATS</span><small>{unfiled.length}</small></div>
          {unfiled.length ? unfiled.map(renderSession) : <p className="history-hint">Your next conversation will appear here.</p>}
        </> : <>{archived.length ? archived.map(renderSession) : <p className="history-hint">Archived chats are kept here until you restore or delete them.</p>}</>}
      </div>
      <div className="history-footer"><button type="button" onClick={() => { close(); startTour(); }}><RotateCcw size={15}/> Replay the guide</button><span>Saved on this device</span></div>
    </aside>
  </>;
}
