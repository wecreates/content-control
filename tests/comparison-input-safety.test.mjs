import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectDecodedMedia,boundedMediaRunner} from '../scripts/exact_av_review.mjs';
test('SYNTHETIC playlists renamed mp4 reject before probing, including changed local dependencies and remote URLs',()=>{
 const dir=mkdtempSync(join(tmpdir(),'synthetic-indirect-'));
 try{
  const media=join(dir,'playlist.mp4'),payload=join(dir,'payload.ts');let calls=0;
  const run=()=>{calls++;throw Error('Must not launch media tools');};
  for(const dependency of ['payload.ts','http://127.0.0.1:1/forbidden.ts','https://example.invalid/forbidden.ts']){
   writeFileSync(media,`#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\n${dependency}\n#EXT-X-ENDLIST\n`);
   for(const bytes of ['SYNTHETIC payload A','SYNTHETIC payload B']){
    writeFileSync(payload,bytes);assert.throws(()=>inspectDecodedMedia(media,run),/direct MP4/);
   }
  }
  assert.equal(calls,0,'No dependency probing or decoding is permitted');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('bound media tools force direct demuxing and disable external tracks even with an MP4-looking header',()=>{
 const dir=mkdtempSync(join(tmpdir(),'synthetic-mp4-header-'));
 try{
  const path=join(dir,'fake.mp4'),header=Buffer.alloc(24);header.writeUInt32BE(24);header.write('ftypisom',4);writeFileSync(path,header);
  assert.throws(()=>inspectDecodedMedia(path,(cmd,args)=>{
   assert.equal(cmd,'ffprobe');assert.deepEqual(args.slice(0,8),['-protocol_whitelist','file','-f','mov','-enable_drefs','0','-use_absolute_path','0']);
   throw Error('Forced demuxer rejects malformed bytes');
  }),/Forced demuxer/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('explicit validation shares one overall subprocess budget',()=>{
 let time=0,calls=0;const run=boundedMediaRunner((_cmd,_args,opts)=>{calls++;assert.equal(opts.timeout,10);time+=11;},{budgetMs:10,now:()=>time});
 assert.throws(()=>run('ffprobe',[],{timeout:30000}),/budget/);assert.throws(()=>run('ffmpeg',[]),/budget/);assert.equal(calls,1);
});
