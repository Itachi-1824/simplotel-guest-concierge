import {existsSync} from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
await import('../dist/server/entry.mjs');
