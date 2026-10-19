// SYNTHETIC receipt contract only; no audiovisual or creative acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {createHostedComparisonGate,comparisonFileVersion,comparisonReviewDigest,hashComparisonFile} from '../scripts/hosted_comparison_receipt.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function swappedInput(replace){
 const dir=mkdtempSync(join(tmpdir(),'synthetic-admission-'));
 try{
  const paths=Array.from({length:5},(_,i)=>join(dir,`input-${i}`)),receiptPath=join(dir,'receipt.json');
  paths.forEach((p,i)=>writeFileSync(p,`SYNTHETIC input ${i}`));
  const hashes=paths.map((_,i)=>digest(`SYNTHETIC input ${i}`)),review={candidate_sha256:hashes[0]};
  const save=()=>writeFileSync(receiptPath,JSON.stringify({status:'VALIDATED_BOUND_REVIEW',ready:true,production_approved:false,publication_enabled:false,perception_verified:false,
   media:{candidate_sha256:hashes[0]},reference_manifest_sha256:hashes[1],session_receipts_sha256:hashes[2],reference_media:hashes.slice(3).map(candidate_sha256=>({candidate_sha256})),
   comparison_evidence:{manifest_path:paths[1],sessions_path:paths[2]},runtime_binding:{schema_version:1,candidate_path:paths[0],review_sha256:comparisonReviewDigest(review),
    files:paths.map((path,i)=>({path,sha256:hashes[i],byte_length:17,version:comparisonFileVersion(path)}))}}));
  save();let first=true,release;
  const opened=new Promise(r=>release=r);
  const gate=createHostedComparisonGate({admissionBudgetMs:process.platform==='win32'?500:25,hash:async(...args)=>{if(first){first=false;await opened;}return hashComparisonFile(...args);}});
  assert.equal(gate(review,paths[0],receiptPath).ready,false);
  // Deterministically replace the path after all gate stats, before the actual open.
  rmSync(paths[0]);replace(paths[0]);release();
  let timer;try{await Promise.race([gate.settled(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Admission remained stuck')),500);})]);}finally{clearTimeout(timer);}
  rmSync(paths[0],{recursive:true,force:true});writeFileSync(paths[0],'SYNTHETIC input 0');save();
  const next=gate(review,paths[0],receiptPath);
  assert.deepEqual(next.reasons,['bound_receipt_admission_pending'],'Failed open must release admission');
  await gate.settled();assert.equal(gate(review,paths[0],receiptPath).ready,true,'Fresh valid receipt recovers without a FIFO writer: '+JSON.stringify(gate(review,paths[0],receiptPath)));
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('directory swapped after gate checks fails promptly and subsequent admission recovers',()=>swappedInput(p=>mkdirSync(p)));
test('FIFO swapped after gate checks requires no writer and admission recovers',{skip:process.platform==='win32'},()=>swappedInput(p=>execFileSync('mkfifo',[p])));
test('special device swapped after gate checks fails promptly and admission recovers',{skip:process.platform==='win32'},()=>swappedInput(p=>symlinkSync('/dev/zero',p)));
test('expired admission does not open an input',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(hashComparisonFile('nonexistent',controller.signal,'invalid'),{name:'AbortError'});
});

async function abortDuringRealStream(reuse){
 const dir=mkdtempSync(join(tmpdir(),'synthetic-stream-abort-'));
 const originalStream=fs.createReadStream,originalClose=fs.close;
 let unrelatedFd=null,targetFd=null,seenData=false,streamClosed;
 const closed=new Promise(r=>streamClosed=r);
 try{
  const paths=Array.from({length:5},(_,i)=>join(dir,`input-${i}`)),receiptPath=join(dir,'receipt.json'),unrelated=join(dir,'unrelated');
  const bytes=paths.map((_,i)=>i===0?Buffer.alloc(256*1024,42):Buffer.from(`SYNTHETIC input ${i}`));
  paths.forEach((p,i)=>writeFileSync(p,bytes[i]));writeFileSync(unrelated,'SYNTHETIC unrelated file');
  const hashes=bytes.map(digest),review={candidate_sha256:hashes[0]};
  const receipt={status:'VALIDATED_BOUND_REVIEW',ready:true,production_approved:false,publication_enabled:false,perception_verified:false,
   media:{candidate_sha256:hashes[0]},reference_manifest_sha256:hashes[1],session_receipts_sha256:hashes[2],reference_media:hashes.slice(3).map(candidate_sha256=>({candidate_sha256})),
   comparison_evidence:{manifest_path:paths[1],sessions_path:paths[2]},runtime_binding:{schema_version:1,candidate_path:paths[0],review_sha256:comparisonReviewDigest(review),
    files:paths.map((path,i)=>({path,sha256:hashes[i],byte_length:bytes[i].length,version:comparisonFileVersion(path)}))}};
  writeFileSync(receiptPath,JSON.stringify(receipt));
  const controller=new AbortController();let abortError;
  const reuseDescriptor=()=>{if(reuse&&unrelatedFd===null)unrelatedFd=fs.openSync(unrelated,'r');};
  // Exercise the real stream. On the old numeric-fd implementation the native
  // close callback reuses the fd before finally invokes FileHandle.close again.
  fs.close=(fd,callback)=>originalClose(fd,error=>{if(fd===targetFd&&!error)reuseDescriptor();callback(error);});
  fs.createReadStream=(path,options)=>{
   const stream=originalStream(path,options);
   if(path===paths[0]){
    targetFd=typeof options.fd==='number'?options.fd:options.fd.fd;
    stream.once('data',()=>{seenData=true;controller.abort();});
    stream.once('close',()=>{reuseDescriptor();streamClosed();});
   }
   return stream;
  };
  syncBuiltinESMExports();
  let abortFirst=true;
  const gate=createHostedComparisonGate({admissionBudgetMs:2000,hash:async(path,signal,version)=>{
   try{return await hashComparisonFile(path,abortFirst?AbortSignal.any([signal,controller.signal]):signal,version);}
   catch(error){abortError=error;throw error;}
  }});
  assert.equal(gate(review,paths[0],receiptPath).ready,false);await gate.settled();await closed;
  assert.equal(seenData,true,'Abort must occur after an actual stream chunk');
  assert.equal(abortError?.name,'AbortError','Cleanup must preserve the abort error');
  assert.deepEqual(gate(review,paths[0],receiptPath).reasons,['bound_receipt_admission_failed']);
  if(reuse){
   assert.equal(unrelatedFd,targetFd,'Regression must actually reuse the released fd');
   const length=Buffer.byteLength('SYNTHETIC unrelated file');
   assert.equal(fs.fstatSync(unrelatedFd).size,length,'Unrelated reused descriptor must remain open');
   const read=Buffer.alloc(length);fs.readSync(unrelatedFd,read,0,length,0);assert.equal(read.toString(),'SYNTHETIC unrelated file');
  }
  fs.createReadStream=originalStream;fs.close=originalClose;syncBuiltinESMExports();abortFirst=false;
  // New receipt identity admits a new attempt after the failed one fully settles.
  writeFileSync(receiptPath,JSON.stringify({...receipt,synthetic_retry:true}));
  assert.deepEqual(gate(review,paths[0],receiptPath).reasons,['bound_receipt_admission_pending']);
  await gate.settled();assert.equal(gate(review,paths[0],receiptPath).ready,true);
 }finally{
  fs.createReadStream=originalStream;fs.close=originalClose;syncBuiltinESMExports();
  if(unrelatedFd!==null){try{fs.closeSync(unrelatedFd);}catch(error){if(error.code!=='EBADF')throw error;}}
  rmSync(dir,{recursive:true,force:true});
 }
}
test('real midstream abort preserves AbortError and admission recovery',()=>abortDuringRealStream(false));
test('real midstream abort never closes an unrelated reused descriptor',()=>abortDuringRealStream(true));
