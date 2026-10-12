import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildWatchInvocation,runWatch,queueWatchResult} from './watch-bridge.mjs';
import {EventEmitter} from 'node:events';
import {routeFinding} from '../../social-intake.js';

test('uses fixed argv and local engine without shell',()=>{
 const v=buildWatchInvocation({url:'https://www.instagram.com/reel/DeUlQTQxv5O/?tracking=1',skillDir:'/tmp/trusted-watch'});
 assert.equal(v.normalized.source_url,'https://www.instagram.com/reel/DeUlQTQxv5O/');
 assert.deepEqual(v.args.slice(-2),['--engine','local']);
 assert.deepEqual(v.args.slice(-4),['--whisper','whisperx','--engine','local'], 'must override configured paid transcription fallback');
 assert.ok(v.args.includes('https://www.instagram.com/reel/DeUlQTQxv5O/'));
});
test('repeated extraction preserves reviewed evidence and remains routable without duplicate intake',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'watch-reviewed-'));
 try{
  const file=join(dir,'queue.json');
  const url='https://www.instagram.com/reel/DeUlQTQxv5O/';
  const record={id:'reviewed',source_url:url,status:'internal_review',analysis_status:'audiovisual_reviewed',publication_enabled:false,
   coverage:{full_video:true,full_audio:true,duration_evidence_ref:'duration',segments:[{start_seconds:0,end_seconds:10,video:true,audio:true,evidence_ref:'av-1'}]},
   evidence:[{id:'duration',kind:'media_probe',verified:true,duration_seconds:10},{id:'av-1',kind:'audiovisual',verified:true,start_seconds:0,end_seconds:10}],findings:[]};
  await writeFile(file,JSON.stringify({version:1,queue:[record]}));
  for(let i=0;i<2;i++)await queueWatchResult({queuePath:file,url,result:{stdout:'new unreviewed extraction'}});
  const q=JSON.parse(await readFile(file,'utf8'));
  assert.equal(q.queue.length,1);
  const saved=q.queue[0];
  assert.deepEqual(saved.coverage,record.coverage);
  assert.deepEqual(saved.evidence,record.evidence);
  assert.equal(saved.status,record.status);
  assert.equal(saved.analysis_status,record.analysis_status);
  assert.equal(saved.retrieval_attempts.length,2);
  assert.equal(saved.unreviewed_watch_output.verified,false);
  assert.deepEqual(saved.unreviewed_watch_output.coverage,{full_video:false,full_audio:false});
  const routed=routeFinding(q,'reviewed',{id:'verified-technique',category:'Content-production technique',project:'Content Control',summary:'Verified observation from an existing completed review.',basis:'audiovisual',evidence_refs:['av-1'],full_analysis:true},{allowedProjects:['Content Control']});
  assert.equal(routed.finding.full_analysis,true);
  assert.equal(routed.finding.publication_enabled,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects unsupported hosts',()=>{
 assert.throws(()=>buildWatchInvocation({url:'https://evil.example/video',skillDir:'/tmp/trusted-watch'}),/Unsupported/);
});
test('persists a pending evidence review without fabricating full coverage',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'watch-bridge-'));
 try{
  const file=join(dir,'queue.json');
  await writeFile(file,JSON.stringify({version:1,queue:[]}));
  await queueWatchResult({queuePath:file,url:'https://www.instagram.com/reel/DeUlQTQxv5O/',result:{stdout:'unverified extracted text'}});
  const q=JSON.parse(await readFile(file,'utf8'));
  assert.equal(q.queue.length,1);
  assert.equal(q.queue[0].analysis_status,'watch_output_pending_evidence_review');
  assert.equal(q.queue[0].coverage.full_video,false);
  assert.equal(q.queue[0].publication_enabled,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('supports captions-only mode and rejects cloud transcription backends',()=>{
 const base={url:'https://www.youtube.com/watch?v=abcdefghijk',skillDir:'/tmp/trusted-watch'};
 assert.ok(buildWatchInvocation({...base,transcription:'none'}).args.includes('--no-whisper'));
 for(const transcription of ['auto','groq','openai','gemini','']) {
   assert.throws(()=>buildWatchInvocation({...base,transcription}),/Only free local/);
 }
});

test('runner receives local-only backend and never promotes extracted output to verified coverage',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'watch-runtime-'));
 try {
  await mkdir(join(dir,'scripts'));
  await writeFile(join(dir,'scripts','watch.py'),'# test fixture');
  let captured;
  const runner=(command,args,options)=>{
   captured={command,args,options};
   const child=new EventEmitter();
   child.stdout=new EventEmitter(); child.stderr=new EventEmitter(); child.kill=()=>{};
   process.nextTick(()=>{child.stdout.emit('data','Timestamped extracted narration');child.emit('close',0);});
   return child;
  };
  const result=await runWatch({url:'https://www.youtube.com/watch?v=abcdefghijk',skillDir:dir,runner});
  assert.deepEqual(captured.args.slice(-4),['--whisper','whisperx','--engine','local']);
  assert.equal(captured.options.shell,false);
  assert.equal(result.full_audiovisual_verified,false);
  assert.match(result.stdout,/narration/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
