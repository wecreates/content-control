import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';

const cli=fileURLToPath(new URL('../scripts/pod_review_cli.mjs',import.meta.url));
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=`#!/usr/bin/env python3
import json,os,signal,subprocess,sys,time
from pathlib import Path
p=Path(os.environ['POD_TEST_ROOT'])
mode=os.environ['POD_TEST_MODE']
if mode=='success':
 print(json.dumps({'args':sys.argv[2:],'cwd':os.getcwd(),'flags':[os.environ['PUBLICATION_ENABLED'],os.environ['POD_PUBLICATION_ENABLED']],'text':'review ✓'}));sys.exit(0)
if mode=='failure':
 print('private fixture stderr',file=sys.stderr);sys.exit(2)
if mode in ('orphan','cancel-tree'):
 child=subprocess.Popen([sys.executable,'-c',"import os,signal,time;from pathlib import Path;signal.signal(signal.SIGTERM,signal.SIG_IGN);Path(os.environ['POD_TEST_ROOT'],'descendant').write_text(str(os.getpid()));time.sleep(30)"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 while not (p/'descendant').exists():time.sleep(.01)
 if mode=='orphan':sys.exit(0)
def stop(sig,frame):
 (p/'terminated').write_text(str(sig));sys.exit(0)
signal.signal(signal.SIGTERM,signal.SIG_IGN if mode=='stubborn' else stop)
(p/'ready').write_text(str(os.getpid()))
time.sleep(30)
`;

async function stopped(pid){
 for(let i=0;i<60;i++){
  try{
   process.kill(pid,0);
   const stat=await fs.readFile(`/proc/${pid}/stat`,'utf8');
   if(stat.slice(stat.lastIndexOf(')')+2).startsWith('Z'))return;
  }catch(e){if(e.code==='ESRCH')return;if(e.code!=='ENOENT')throw e;}
  await wait(10);
 }
 assert.fail(`fixture process ${pid} remains running`);
}

async function withCLI(mode,fn){
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pod-cli-'));
 const exe=path.join(tmp,'fixture-python');await fs.writeFile(exe,fixture,{mode:0o755});
 const child=spawn(process.execPath,[cli,'input.json','font.ttf','review-output'],{
  cwd:tmp,env:{...process.env,POD_PYTHON:exe,POD_TEST_ROOT:tmp,POD_TEST_MODE:mode,
   PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
 const exited=once(child,'exit');
 const closed=once(child,'close');
 const readPID=async name=>{
  for(let i=0;i<200;i++){
   try{const pid=Number(await fs.readFile(path.join(tmp,name),'utf8'));if(Number.isInteger(pid)&&pid>0)return pid;}catch{}
   await wait(10);
  }
  throw Error('fixture did not initialize: '+name);
 };
 const exit=()=>Promise.race([exited,wait(12000,undefined,{ref:false}).then(()=>{throw Error('CLI did not exit');})]);
 try{await fn({child,tmp,readPID,exit,closed,output:()=>({stdout,stderr})});}
 finally{
  for(const name of ['ready','descendant']){
   try{const pid=Number(await fs.readFile(path.join(tmp,name),'utf8'));process.kill(pid,'SIGKILL');}catch{}
  }
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  await closed;await fs.rm(tmp,{recursive:true,force:true});
 }
}

for(const signal of ['SIGTERM','SIGINT'])test('CLI '+signal+' cancels child even when it exits zero',async()=>{
 await withCLI('wait',async({child,tmp,readPID,exit})=>{
  const pid=await readPID('ready');child.kill(signal);
  const [code]=await exit();await stopped(pid);
  assert.equal(code,1);assert.equal(await fs.readFile(path.join(tmp,'terminated'),'utf8'),'15');
 });
});

test('CLI cancellation kills descendants that ignore SIGTERM',async()=>{
 await withCLI('cancel-tree',async({child,readPID,exit})=>{
  const pid=await readPID('ready'),descendant=await readPID('descendant');child.kill('SIGTERM');
  const [code]=await exit();await stopped(pid);await stopped(descendant);assert.equal(code,1);
 });
});

test('CLI rejects zero-exit parent with leftover detached-output descendant',async()=>{
 await withCLI('orphan',async({readPID,exit})=>{
  const pid=await readPID('descendant');const [code]=await exit();await stopped(pid);assert.equal(code,1);
 });
});

test('CLI escalates cancellation for a SIGTERM-resistant child',async()=>{
 await withCLI('stubborn',async({child,readPID,exit})=>{
  const pid=await readPID('ready');child.kill('SIGTERM');const [code]=await exit();
  await stopped(pid);assert.equal(code,1);
 });
});

test('CLI preserves relative caller paths, exact stdout and disabled flags',async()=>{
 await withCLI('success',async({tmp,exit,closed,output})=>{
  const [code]=await exit();await closed;assert.equal(code,0);
  const value=JSON.parse(output().stdout);
  assert.deepEqual(value.args,['--input',path.join(tmp,'input.json'),'--font',path.join(tmp,'font.ttf'),'--output',path.join(tmp,'review-output')]);
  assert.equal(path.resolve(value.cwd),path.resolve(root));
  assert.deepEqual(value.flags,['false','false']);assert.equal(value.text,'review ✓');
 });
});

test('CLI failure output excludes child stderr',async()=>{
 await withCLI('failure',async({exit,closed,output})=>{
  const [code]=await exit();await closed;assert.equal(code,1);
  assert.equal(output().stdout,'');assert.equal(output().stderr.trim(),'REVIEW_GENERATION_FAILED');
 });
});
