// Cheap receipt freshness checks on requests; full-byte admission runs asynchronously.
// No subprocesses, probes or decoders are imported or started in this module.
import {constants,statSync,openSync,closeSync,fstatSync,readSync,realpathSync,createReadStream} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
const MAX_JSON=512*1024,MAX_FILE=512*1024*1024,MAX_TOTAL=2*1024*1024*1024;
const fileVersion=(path,s)=>[realpathSync(path),s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
export function comparisonFileVersion(path){
 const s=statSync(path,{bigint:true});if(!s.isFile())throw Error('Regular file required');
 return fileVersion(path,s);
}
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export const comparisonReviewDigest=review=>createHash('sha256').update(canonical(review)).digest('hex');
function readReceipt(path){
 const version=comparisonFileVersion(path),fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK);
 try{
  const s=fstatSync(fd);if(!s.isFile()||s.size<=0||s.size>MAX_JSON)throw Error('Invalid receipt size');
  const bytes=Buffer.alloc(s.size+1);let size=0,n;
  while(size<bytes.length&&(n=readSync(fd,bytes,size,bytes.length-size,null)))size+=n;
  if(size!==s.size||comparisonFileVersion(path)!==version)throw Error('Receipt changed');
  return {version,receipt:JSON.parse(bytes.subarray(0,size).toString('utf8'))};
 }finally{closeSync(fd);}
}
export async function hashComparisonFile(path,signal,expectedVersion){
 signal.throwIfAborted();
 // Never let an asynchronous path open wait for a FIFO writer. The descriptor
 // must be the same regular file checked by the gate before any bytes are read.
 const handle=await open(path,constants.O_RDONLY|constants.O_NONBLOCK);
 try{
  signal.throwIfAborted();
  const before=await handle.stat({bigint:true});
  if(!before.isFile()||before.size<=0n||before.size>BigInt(MAX_FILE)||fileVersion(path,before)!==expectedVersion)throw Error('Opened input changed or is not regular');
  const hash=createHash('sha256');let size=0;
  // Share the FileHandle itself with the stream: abort-driven stream destruction
  // and finally must coordinate ownership, never close a reused numeric fd twice.
  // The stream uses this descriptor without reopening the path.
  for await(const chunk of createReadStream(path,{fd:handle,autoClose:false,highWaterMark:64*1024,signal})){
   size+=chunk.length;if(size>MAX_FILE)throw Error('File too large');hash.update(chunk);
  }
  signal.throwIfAborted();
  if(size!==Number(before.size)||fileVersion(path,await handle.stat({bigint:true}))!==expectedVersion)throw Error('Opened input changed during read');
  return hash.digest('hex');
 }finally{await handle.close();}
}
const blocked=reason=>({ready:false,status:'BLOCKED',reasons:[reason],production_approved:false,publication_enabled:false,perception_verified:false});
export function createHostedComparisonGate({hash=hashComparisonFile,admissionBudgetMs=30000}={}){
 let state=null,pending=null;
 const check=(review,video,receiptPath)=>{
  try{
   if(!review||!video||!receiptPath)return blocked('bound_receipt_required');
   const {receipt:r,version}=readReceipt(receiptPath),seal=r.runtime_binding;
   if(r.status!=='VALIDATED_BOUND_REVIEW'||r.ready!==true||r.production_approved!==false||r.publication_enabled!==false||r.perception_verified!==false||
      seal?.schema_version!==1||seal.review_sha256!==comparisonReviewDigest(review)||resolve(seal.candidate_path)!==resolve(video)||
      !Array.isArray(seal.files)||seal.files.length<5||seal.files.length>23) return blocked('bound_receipt_invalid');
   const files=seal.files;
   if(new Set(files.map(f=>f.path)).size!==files.length||files.some(f=>typeof f.path!=='string'||typeof f.version!=='string'||!/^[a-f0-9]{64}$/.test(f.sha256)||!Number.isSafeInteger(f.byte_length)||f.byte_length<=0||f.byte_length>MAX_FILE)||files.reduce((n,f)=>n+f.byte_length,0)>MAX_TOTAL)return blocked('bound_receipt_inputs_invalid');
   const expected=[r.media?.candidate_sha256,r.reference_manifest_sha256,r.session_receipts_sha256,...(r.reference_media||[]).map(f=>f.candidate_sha256)];
   if(files.length!==expected.length||files.some((f,i)=>f.sha256!==expected[i])||resolve(files[0].path)!==resolve(video)||files[0].sha256!==review.candidate_sha256||resolve(files[1].path)!==resolve(r.comparison_evidence.manifest_path)||resolve(files[2].path)!==resolve(r.comparison_evidence.sessions_path))return blocked('bound_receipt_candidate_or_inputs_mismatch');
   if(files.some(f=>comparisonFileVersion(f.path)!==f.version))return blocked('bound_receipt_inputs_changed');
   const key=resolve(receiptPath)+':'+version+':'+seal.review_sha256;
   if(state?.key===key)return state.result;
   // Never fan out or queue expensive admissions on concurrent public requests.
   if(pending)return blocked('bound_receipt_admission_busy');
   state={key,result:blocked('bound_receipt_admission_pending')};const attempt=state;
   pending=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),admissionBudgetMs);
    try{
     for(const f of files){
      if(controller.signal.aborted||comparisonFileVersion(f.path)!==f.version||await hash(f.path,controller.signal,f.version)!==f.sha256||comparisonFileVersion(f.path)!==f.version)throw Error('Input changed or mismatched');
     }
     if(controller.signal.aborted||comparisonFileVersion(receiptPath)!==version||files.some(f=>comparisonFileVersion(f.path)!==f.version))throw Error('Evidence changed');
     attempt.result={ready:true,status:'VALIDATED_BOUND_REVIEW',reasons:[],candidate_sha256:review.candidate_sha256,production_approved:false,publication_enabled:false,perception_verified:false};
    }catch{attempt.result=blocked('bound_receipt_admission_failed');}
    finally{clearTimeout(timer);}
   })().finally(()=>{pending=null;});
   return attempt.result;
  }catch{return blocked('bound_receipt_unavailable_or_invalid');}
 };
 check.settled=()=>pending||Promise.resolve();
 return check;
}
