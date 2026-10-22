import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import crypto from 'node:crypto';
import {parseSignedJSON} from './signed-json.mjs';
import {verifyEnvelope} from './policy.mjs';

const MAX_SOURCE_BYTES=16*1024*1024;
const MAX_RIGHTS_BYTES=4*1024*1024;

async function snapshot(filename,maxBytes,reason,active){
 if(typeof filename!=='string'||!filename)throw Error('SOURCE_EVIDENCE_REQUIRED');
 let handle;
 try{
  handle=await fs.open(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  active();
  const stat=await handle.stat();
  if(!stat.isFile()||!Number.isSafeInteger(stat.size)||stat.size<1||stat.size>maxBytes)throw Error(reason);
  const body=Buffer.alloc(stat.size);let offset=0;
  while(offset<body.length){
   active();
   const {bytesRead}=await handle.read(body,offset,body.length-offset,offset);
   if(!bytesRead)throw Error(reason);offset+=bytesRead;
  }
  active();
  if((await handle.read(Buffer.alloc(1),0,1,offset)).bytesRead)throw Error(reason);
  return body;
 }catch(error){
  if(error?.message==='PRODUCTION_STOPPED'||error?.message==='SOURCE_EVIDENCE_REQUIRED'||error?.message===reason)throw error;
  throw Error(reason);
 }finally{if(handle)await handle.close();}
}

// Authenticate the exact task rights and source bytes in the parent process.
// A valid signature and matching digest establish identity only, not ownership.
export async function verifySourceEvidence(sourceFilename,rightsFilename,key,{signal}={}){
 const active=()=>{if(signal?.aborted)throw Error('PRODUCTION_STOPPED');};
 active();
 const source=await snapshot(sourceFilename,MAX_SOURCE_BYTES,'SOURCE_BYTES_INVALID',active);
 const rightsBytes=await snapshot(rightsFilename,MAX_RIGHTS_BYTES,'SOURCE_RIGHTS_INVALID',active);
 let envelope,rights;
 try{
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(rightsBytes);
  envelope=parseSignedJSON(text);
  rights=verifyEnvelope(envelope,key,'pod:asset-rights');
 }catch(error){
  if(error?.message==='SIGNING_KEY_REQUIRED')throw error;
  throw Error('SOURCE_RIGHTS_INVALID');
 }
 if(rights?.status!=='PASS'||typeof rights.source_sha256!=='string'||
  !/^[a-f0-9]{64}$/.test(rights.source_sha256))throw Error('SOURCE_RIGHTS_INVALID');
 const sourceSha256=crypto.createHash('sha256').update(source).digest('hex');
 if(sourceSha256!==rights.source_sha256)throw Error('SOURCE_HASH_MISMATCH');
 active();
 return sourceSha256;
}
