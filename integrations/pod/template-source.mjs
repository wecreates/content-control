import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import crypto from 'node:crypto';

// Identity of retained bytes only. The caller must authenticate the provenance
// envelope first; a matching hash is not official-origin or print approval.
export async function verifyTemplateSource(filename,expected,{signal}={}){
 const active=()=>{if(signal?.aborted)throw Error('PRODUCTION_STOPPED');};
 active();
 if(typeof filename!=='string'||!filename)throw Error('TEMPLATE_SOURCE_REQUIRED');
 if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 let handle;
 try{
  handle=await fs.open(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  active();
  const stat=await handle.stat(),limit=16*1024*1024;
  if(!stat.isFile()||stat.size===0)throw Error('TEMPLATE_SOURCE_INVALID');
  if(stat.size>limit)throw Error('TEMPLATE_SOURCE_TOO_LARGE');
  const hash=crypto.createHash('sha256'),buffer=Buffer.alloc(64*1024);
  let total=0;
  for(;;){
   active();
   const {bytesRead}=await handle.read(buffer,0,Math.min(buffer.length,limit+1-total),null);
   active();
   if(!bytesRead)break;
   total+=bytesRead;
   if(total>limit)throw Error('TEMPLATE_SOURCE_TOO_LARGE');
   hash.update(buffer.subarray(0,bytesRead));
  }
  if(!total)throw Error('TEMPLATE_SOURCE_INVALID');
  if(hash.digest('hex')!==expected)throw Error('TEMPLATE_SOURCE_HASH_MISMATCH');
 }catch(error){
  if(['PRODUCTION_STOPPED','TEMPLATE_SOURCE_INVALID','TEMPLATE_SOURCE_TOO_LARGE','TEMPLATE_SOURCE_HASH_MISMATCH'].includes(error?.message))throw error;
  throw Error('TEMPLATE_SOURCE_INVALID');
 }finally{if(handle)await handle.close();}
}
