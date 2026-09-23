import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
const python=process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python';
if(existsSync('.env')) process.loadEnvFile('.env');
if(!existsSync(python)){console.error('Create .venv and install model_service/requirements.txt first. See README.md.');process.exit(1);}
const child=spawn(python,['-m',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,PYTHONUTF8:'1'}});
child.on('exit',code=>{process.exitCode=code??1;});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
