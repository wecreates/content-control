// SYNTHETIC receipt contract only; no audiovisual or creative acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
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
