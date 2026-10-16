import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {runPythonStage} from '../integrations/pod/python-stage.mjs';

async function assertStopped(pid){
 for(let i=0;i<100;i++){
  try{
   // Orphan zombies cannot run or retain descriptors, but may await PID 1.
   if(process.platform==='linux'){
    const stat=await fs.readFile(`/proc/${pid}/stat`,'utf8');
    if(stat.slice(stat.lastIndexOf(')')+2).startsWith('Z'))return;
   }
   process.kill(pid,0);
  }catch(error){if(['ESRCH','ENOENT'].includes(error.code))return;throw error;}
  await wait(10);
 }
 assert.fail('descendant still running after stage settled');
}

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
test('structured stage failures expose only a fixed reason code',async()=>{
 for(const [stdout,expected] of [
  [JSON.stringify({status:'BLOCKED',reason_code:'NATIVE_RESOLUTION_INSUFFICIENT',private:'secret'}),'NATIVE_RESOLUTION_INSUFFICIENT'],
  [JSON.stringify({status:'BLOCKED',reason_code:'postgres://private:secret@host/db'}),'PRODUCTION_BLOCKED'],
  [JSON.stringify({status:'GENERATED',reason_code:'TEXT_CLIPPED'}),'PRODUCTION_BLOCKED'],
  ['not JSON: secret','PRODUCTION_BLOCKED'],
  ['null','PRODUCTION_BLOCKED'],
  [JSON.stringify({status:'BLOCKED',reason_code:{secret:true}}),'PRODUCTION_BLOCKED']
 ])await fixture(`process.stdout.write(${JSON.stringify(stdout)});process.stderr.write('secret');process.exit(2);`,async options=>{
  await assert.rejects(runPythonStage('fixture.cjs',[],options),error=>{
   assert.equal(error.message,'PYTHON_STAGE_FAILED');assert.equal(error.reasonCode,expected);
   assert.ok(!JSON.stringify(error).includes('secret'));assert.ok(!error.stack.includes('secret'));return true;
  });
 });
});
test('stderr and combined output count toward the same bounded budget',async()=>{
 for(const source of ["process.stderr.write('private'.repeat(1000));",
  "process.stdout.write('x'.repeat(60));process.stderr.write('y'.repeat(60));"]){
  await fixture(source,async options=>await assert.rejects(
   runPythonStage('fixture.cjs',[],{...options,maxOutputBytes:100}),/PYTHON_STAGE_OUTPUT_LIMIT/));
 }
});

test('cancellation kills descendants that ignore SIGTERM and retain output pipes',async()=>{
 const source=`const fs=require('node:fs'),{spawn}=require('node:child_process');
 process.on('SIGTERM',()=>{});
 const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});require('node:fs').writeFileSync('descendant',String(process.pid));setInterval(()=>{},50);"],{stdio:['ignore',1,2]});
 fs.writeFileSync('parent',String(process.pid));setInterval(()=>{},50);`;
 await fixture(source,async options=>{
  const controller=new AbortController();let descendant,parent;
  const result=runPythonStage('fixture.cjs',[],{...options,signal:controller.signal}).then(()=>({ok:true}),error=>({error}));
  try{
   for(let i=0;i<100;i++){
    try{descendant=Number(await fs.readFile(path.join(options.root,'descendant'),'utf8'));
     parent=Number(await fs.readFile(path.join(options.root,'parent'),'utf8'));break;}catch{await wait(10);}
   }
   assert.ok(descendant&&parent,'both processes initialized');controller.abort();
   const outcome=await Promise.race([result,wait(600).then(()=>({pending:true}))]);
   assert.equal(outcome.error?.message,'PYTHON_STAGE_ABORTED','stage must settle after killing the whole group');
   await assertStopped(descendant);
  }finally{
   controller.abort();
   for(const pid of [descendant,parent])if(pid)try{process.kill(pid,'SIGKILL');}catch{}
   await result;
  }
 });
});

for(const mode of ['timeout','overflow','parent-exit-with-pipes','parent-exit-without-pipes']){
 test('descendant cleanup: '+mode,async()=>{
  const source=`const fs=require('node:fs'),{spawn}=require('node:child_process');
  const mode=${JSON.stringify(mode)};
  process.on('SIGTERM',()=>{});
  const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});require('node:fs').writeFileSync('descendant',String(process.pid));setInterval(()=>{},50);"],
   {stdio:mode==='parent-exit-without-pipes'?'ignore':['ignore',1,2]});
  fs.writeFileSync('parent',String(process.pid));
  const ready=setInterval(()=>{if(!fs.existsSync('descendant'))return;clearInterval(ready);
   if(mode.startsWith('parent-exit'))process.exit(0);
   if(mode==='overflow')process.stdout.write('x'.repeat(10000));
  },10);setInterval(()=>{},50);`;
  await fixture(source,async options=>{
   let descendant,parent;
   const result=runPythonStage('fixture.cjs',[],{...options,timeoutMs:1500,maxOutputBytes:1000})
    .then(()=>({ok:true}),error=>({error}));
   try{
    for(let i=0;i<100;i++){
     try{descendant=Number(await fs.readFile(path.join(options.root,'descendant'),'utf8'));
      parent=Number(await fs.readFile(path.join(options.root,'parent'),'utf8'));break;}catch{await wait(10);}
    }
    assert.ok(descendant&&parent,'both processes initialized');
    const outcome=await Promise.race([result,wait(2500).then(()=>({pending:true}))]);
    const expected=mode==='timeout'?'PYTHON_STAGE_TIMEOUT':mode==='overflow'?'PYTHON_STAGE_OUTPUT_LIMIT':'PYTHON_STAGE_DESCENDANTS_REMAIN';
    assert.equal(outcome.error?.message,expected);
    await assertStopped(descendant);
   }finally{
    for(const pid of [descendant,parent])if(pid)try{process.kill(pid,'SIGKILL');}catch{}
    await result;
   }
  });
 });
}

