import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildWatchInvocation,queueWatchResult} from './watch-bridge.mjs';

test('uses fixed argv and local engine without shell',()=>{
 const v=buildWatchInvocation({url:'https://www.instagram.com/reel/DeUlQTQxv5O/?tracking=1',skillDir:'/tmp/trusted-watch'});
 assert.equal(v.normalized.source_url,'https://www.instagram.com/reel/DeUlQTQxv5O/');
 assert.deepEqual(v.args.slice(-2),['--engine','local']);
 assert.ok(v.args.includes('https://www.instagram.com/reel/DeUlQTQxv5O/'));
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
