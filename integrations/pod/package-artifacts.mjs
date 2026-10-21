import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {MAX_PACKAGE_BYTES} from './artifacts.mjs';
import {PLATFORMS} from './policy.mjs';

const PACKAGE_MEDIA_TYPES=Object.freeze({
 'print.png':'image/png','art-mask.png':'image/png','text-mask.png':'image/png',
 'cover.pdf':'application/pdf','interior.pdf':'application/pdf',
 'interior.receipt.json':'application/json',
});
const BASE_FILES=Object.freeze(['art-mask.png','print.png','text-mask.png']);
const KDP_FILES=Object.freeze([...BASE_FILES,'cover.pdf','interior.pdf','interior.receipt.json'].sort());

export async function readPackageArtifacts(directory,files,{maxObjectBytes=16777216,maxBatchBytes=MAX_PACKAGE_BYTES,platform}={}){
 if(!Number.isSafeInteger(maxObjectBytes)||maxObjectBytes<1||maxObjectBytes>16777216||
  !Number.isSafeInteger(maxBatchBytes)||maxBatchBytes<1||maxBatchBytes>MAX_PACKAGE_BYTES)throw Error('ARTIFACT_LIMIT_INVALID');
 if(!files||typeof files!=='object'||Array.isArray(files)||!Object.keys(files).length||Object.keys(files).length>32)throw Error('ARTIFACT_BATCH_INVALID');
 const names=Object.keys(files);
 if(names.some(name=>!Object.hasOwn(PACKAGE_MEDIA_TYPES,name)))throw Error('ARTIFACT_PACKAGE_INVALID');
 if(platform!==undefined){
  if(!PLATFORMS.includes(platform))throw Error('ARTIFACT_PACKAGE_INVALID');
  const expected=platform==='kdp'?KDP_FILES:BASE_FILES;
  if(JSON.stringify([...names].sort())!==JSON.stringify(expected))throw Error('ARTIFACT_PACKAGE_INVALID');
 }
 const base=await fs.realpath(directory),artifacts=[];let total=0;
 for(const [name,sha] of Object.entries(files)){
  if(!/^[a-f0-9]{64}$/.test(sha))throw Error('ARTIFACT_HASH_MISMATCH');
  const file=await fs.realpath(path.resolve(base,name));
  if(!file.startsWith(base+path.sep))throw Error('ARTIFACT_PATH_INVALID');
  // Do not block on pipes or follow a replaced final symlink. Check the open
  // descriptor, then read into a fixed-size allocation bounded before IO.
  const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
   const info=await handle.stat();
   if(!info.isFile()||!Number.isSafeInteger(info.size)||info.size<1||info.size>maxObjectBytes)throw Error('ARTIFACT_INVALID');
   total+=info.size;if(total>maxBatchBytes)throw Error('ARTIFACT_BATCH_TOO_LARGE');
   const body=Buffer.alloc(info.size);let offset=0;
   while(offset<body.length){
    const {bytesRead}=await handle.read(body,offset,body.length-offset,offset);
    if(!bytesRead)throw Error('ARTIFACT_HASH_MISMATCH');offset+=bytesRead;
   }
   if((await handle.read(Buffer.alloc(1),0,1,offset)).bytesRead||crypto.createHash('sha256').update(body).digest('hex')!==sha)throw Error('ARTIFACT_HASH_MISMATCH');
   artifacts.push({body,mediaType:PACKAGE_MEDIA_TYPES[name]});
  }finally{await handle.close();}
 }
 return artifacts;
}
