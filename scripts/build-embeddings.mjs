import fs from 'node:fs/promises';
import hotel from '../data/hotel.json' with { type:'json' };
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
if (!apiKey) { console.error('Set OPENAI_API_KEY to build semantic embeddings.'); process.exit(1); }
const response = await fetch(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/,'')}/embeddings`, {
  method:'POST', headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' },
  body:JSON.stringify({ model, input:hotel.facts.map((fact) => `${fact.question}\n${fact.answer}\n${fact.tags.join(', ')}`) }), signal:AbortSignal.timeout(30000)
});
if (!response.ok) throw new Error(`Embedding build failed: ${response.status}`);
const data = await response.json();
const vectors = Object.fromEntries(data.data.map((entry) => [hotel.facts[entry.index].id, entry.embedding]));
await fs.writeFile(new URL('../data/embeddings.json', import.meta.url), JSON.stringify({ model, vectors }));
console.log(`Built ${Object.keys(vectors).length} embeddings with ${model}.`);
