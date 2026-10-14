import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {runPythonStage} from '../integrations/pod/python-stage.mjs';

async function fixture(source,fn){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-process-'));
 await fs.mkdir(path.join(root,'scripts'));
 await fs.writeFile(path.join(root,'scripts','fixture.cjs'),source);
 try{await fn({root,env:{...process.env,POD_PYTHON:process.execPath},timeoutMs:2000,killGraceMs:40});}
 finally{await fs.rm(root,{recursive:true,force:true});}
}
test('stage captures exact UTF-8 and redacts nonzero/spawn errors',async()=>{
 await fixture("process.stdout.write('readable ✓');",async options=>assert.equal(await runPythonStage('fixture.cjs',[],options),'readable ✓'));
 await fixture("process.stderr.write('private');process.exit(2);",async options=>await assert.rejects(runPythonStage('fixture.cjs',[],options),/^Error: PYTHON_STAGE_FAILED$/));
 await fixture('',async options=>await assert.rejects(runPythonStage('fixture.cjs',[],{...options,env:{POD_PYTHON:'/nonexistent-pod-python'}}),/^Error: PYTHON_STAGE_SPAWN_FAILED$/));
});
test('output overflow fails even when the process exits successfully',async()=>{
 await fixture("process.stdout.write('x'.repeat(10000));",async options=>await assert.rejects(runPythonStage('fixture.cjs',[],{...options,maxOutputBytes:100}),/PYTHON_STAGE_OUTPUT_LIMIT/));
});
test('aborted stages are reaped even when they ignore SIGTERM',async()=>{
 await fixture("const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync('ready',String(process.pid));setInterval(()=>{},50);",async options=>{
  const controller=new AbortController();
  const result=runPythonStage('fixture.cjs',[],{...options,signal:controller.signal});
  // Attach rejection handling immediately; wait until the child installed its handler.
  const rejection=assert.rejects(result,/PYTHON_STAGE_ABORTED/);
  let pid;
  for(let i=0;i<100;i++){try{pid=Number(await fs.readFile(path.join(options.root,'ready'),'utf8'));break;}catch{await wait(10);}}
  assert.ok(pid,'child reached initialized state');controller.abort();await rejection;
  assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
 });
});
test('deadline and pre-aborted signal cannot succeed',async()=>{
 await fixture('setInterval(()=>{},50);',async options=>{
  await assert.rejects(runPythonStage('fixture.cjs',[],{...options,timeoutMs:100}),/PYTHON_STAGE_TIMEOUT/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(runPythonStage('fixture.cjs',[],{...options,signal:controller.signal}),/PYTHON_STAGE_ABORTED/);
 });
});
