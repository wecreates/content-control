import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runAudioProcess} from './audio-process.mjs';
function runtime(){return {ffmpeg:args=>{
 const proc=spawn('ffmpeg',['-v','error','-nostdin','-progress','pipe:1','-stats_period','0.1',...args],{stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>proc.kill('SIGKILL'),5000);
 proc.once('close',()=>clearTimeout(timer));
 const done=new Promise((resolve,reject)=>{proc.once('error',reject);proc.once('close',code=>code===0?resolve():reject(Error('child failed')));});
 return {proc,done};},kill:proc=>proc.kill('SIGKILL')};}
for(const stage of ['mix','mux'])test(`real FFmpeg ${stage} child cancellation settles and exits`,async()=>{
 const c=new AbortController();let proc,closed=false,progress='';
 const dir=mkdtempSync(join(tmpdir(),'openfilm-cancel-'));
 const args=stage==='mix'?['-re','-f','lavfi','-i','sine=duration=60','-af','apad','-f','null','-']:
  ['-re','-f','lavfi','-i','sine=duration=60','-c:a','copy','-f','matroska',join(dir,'partial.mka')];
 try{
 await assert.rejects(runAudioProcess(args,{signal:c.signal,stage,onProcessStarted:x=>{
  assert.equal(x.stage,stage);proc=x.proc;proc.once('close',()=>closed=true);
  proc.stdout.on('data',b=>{progress+=b; if(/out_time_us=[1-9][0-9]*/.test(progress))c.abort();});
 }},runtime()),/cancelled/);
 assert.ok(proc.pid>0);assert.equal(closed,true);assert.ok(proc.exitCode!==null||proc.signalCode!==null);
 assert.match(progress,/out_time_us=[1-9][0-9]*/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('pre-cancel never launches; cancellation during factory creation kills and settles',async()=>{
 const c=new AbortController();c.abort();
 await assert.rejects(runAudioProcess([],{signal:c.signal,stage:'mix'},{ffmpeg:()=>assert.fail('launched')}),/cancelled/);
 const d=new AbortController();let killed=0,reject;
 await assert.rejects(runAudioProcess([],{signal:d.signal,stage:'mux'}, {
  ffmpeg:()=>{d.abort();return {proc:{},done:new Promise((_,r)=>reject=r)};},
  kill:()=>{killed++;reject(Error('terminated'));}
 }),/cancelled/);assert.equal(killed,1);
});
