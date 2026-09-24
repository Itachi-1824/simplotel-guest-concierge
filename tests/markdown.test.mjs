import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import MessageMarkdown from '../src/components/MessageMarkdown.mjs';
const render=text=>renderToStaticMarkup(createElement(MessageMarkdown,{text}));
test('the reported dinner reply renders emphasis and lists',()=>{
 const html=render('**Dinner at Sera 🍽️**\n\n- From **6:30 PM to 10:00 PM**\n- Reservations recommended');
 assert.match(html,/<strong>Dinner at Sera/);
 assert.match(html,/<ul>/);assert.match(html,/<li>/);
 assert.doesNotMatch(html,/\*\*Dinner/);
});
test('raw HTML, script links and remote images are not activated',()=>{
 const html=render('<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![tracking](https://example.test/track)\n\n[guide](https://example.test/guide)');
 assert.doesNotMatch(html,/<script|<img|href="javascript:/i);
 assert.match(html,/rel="noopener noreferrer"/);
 assert.match(html,/href="https:\/\/example.test\/guide"/);
});
test('tables scroll inside the message and partial streamed syntax stays renderable',()=>{
 assert.match(render('| Room | Guests |\n| --- | --- |\n| Terrace | 3 |'),/class="chat-table"/);
 assert.doesNotThrow(()=>render('Dinner is **available'));
});
