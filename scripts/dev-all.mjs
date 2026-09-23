import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const python = process.platform === 'win32' ? join('.venv','Scripts','python.exe') : join('.venv','bin','python');
if (existsSync('.env')) process.loadEnvFile('.env');
if (!existsSync(python)) {
  console.error('Local AI is not installed. Run the Python setup steps in README.md first.');
  process.exit(1);
}
const children = [
  spawn(python, ['-m','uvicorn','model_service.app:app','--host','127.0.0.1','--port','8001'], {stdio:'inherit',env:{...process.env,USE_TF:'0',PYTHONUTF8:'1'}}),
  spawn(process.execPath, ['node_modules/astro/bin/astro.mjs','dev','--host','0.0.0.0'], {stdio:'inherit',env:{...process.env,LOCAL_AI_URL:'http://127.0.0.1:8001'}})
];
const stop = () => { for (const child of children) if (!child.killed) child.kill(); };
process.on('SIGINT',stop); process.on('SIGTERM',stop);
for (const child of children) child.on('exit',(code) => { if (code && code !== 0) { stop(); process.exitCode = code; } });
for (const child of children) child.on('error',(error) => { console.error(error.message); stop(); process.exitCode = 1; });
