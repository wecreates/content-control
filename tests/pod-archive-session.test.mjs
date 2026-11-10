import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {runArchiveSession} from '../integrations/pod/archive-session.mjs';
import {archiveCLI} from '../scripts/pod_artifact_archive.mjs';
import {stateArchiveCLI} from '../scripts/pod_state_archive.mjs';

const env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',POD_ARCHIVE_KEY:'a'.repeat(64)};
const never=()=>new Promise(()=>{});
const run=promisify(execFile);

for(const cli of [archiveCLI,stateArchiveCLI])test(cli.name+' aborts a pending pool factory and closes its late result',async()=>{
 const controller=new AbortController(),reason=Error('fixture abort');let finish,ended=0;
 const task=cli(['export','/unused-fixture-path'],env,{signal:controller.signal,connect:()=>new Promise(resolve=>{
  finish=resolve;controller.abort(reason);
 })});
 await assert.rejects(task,e=>e===reason);
 assert.equal(typeof finish,'function');
 finish({end(){ended++;return Promise.reject(Error('late shutdown failure'));}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ended,1);
});

test('standalone archive session keeps its timeout alive through a stalled pool shutdown',async()=>{
 const module=new URL('../integrations/pod/archive-session.mjs',import.meta.url).href;
 const code=`import {runArchiveSession} from ${JSON.stringify(module)};
 let ended=0;
 try {
  await runArchiveSession(async({openPool})=>{await openPool({});return 'false success';},
   {timeoutMs:35,connect:()=>({end(){ended++;return new Promise(()=>{});}})});
  process.exitCode=1;
 } catch(error) {
  if(error.message!=='POD_ARCHIVE_TIMEOUT'||ended!==1)throw error;
  console.log('bounded failure');
 }`;
 const {stdout}=await run(process.execPath,['--input-type=module','-e',code],{timeout:3000});
 assert.equal(stdout.trim(),'bounded failure');
});

test('archive session initiates shutdown after expiry without masking original failure',async()=>{
 const controller=new AbortController(),original=Error('archive failure');let ended=0;
 await assert.rejects(runArchiveSession(async({openPool})=>{
  await openPool({});controller.abort();throw original;
 },{signal:controller.signal,connect:()=>({end(){ended++;return never();}})}),e=>e===original);
 assert.equal(ended,1);
});

test('archive session leaves an in-flight commit to settle and withholds success on abort',async()=>{
 const controller=new AbortController(),reason=Error('fixture abort');let ended=0,settled=false,finish;
 const task=runArchiveSession(async({openPool})=>{
  await openPool({});
  const result=await new Promise(resolve=>{finish=resolve;controller.abort(reason);});
  settled=true;return result;
 },{signal:controller.signal,connect:()=>({end(){ended++;}})});
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(settled,false);assert.equal(ended,0);
 finish('commit completed');
 await assert.rejects(task,e=>e===reason);
 assert.equal(settled,true);assert.equal(ended,1);
});
