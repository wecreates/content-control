import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {parseSignedJSON} from './signed-json.mjs';

// A decoded signed payload is capped at 256 KiB by verifyEnvelope. Keep enough
// room for JSON escaping and the outer signature without permitting an
// unbounded local file to be read into the production coordinator.
export const MAX_SIGNED_FILE_BYTES=2*1024*1024;

export async function readSignedJSONFile(filename,{signal,reason='ENVELOPE_INVALID'}={}){
 const active=()=>{if(signal?.aborted)throw Error('PRODUCTION_STOPPED');};
 let handle;
 try{
  active();
  if(typeof filename!=='string'||!filename)throw Error(reason);
  handle=await fs.open(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  active();
  const stat=await handle.stat();
  if(!stat.isFile()||!Number.isSafeInteger(stat.size)||stat.size<1||stat.size>MAX_SIGNED_FILE_BYTES)
   throw Error(reason);
  const body=Buffer.alloc(stat.size);let offset=0;
  while(offset<body.length){
   active();
   const {bytesRead}=await handle.read(body,offset,body.length-offset,offset);
   if(!bytesRead)throw Error(reason);
   offset+=bytesRead;
  }
  active();
  if((await handle.read(Buffer.alloc(1),0,1,offset)).bytesRead)throw Error(reason);
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body);
  return parseSignedJSON(text);
 }catch(error){
  if(error?.message==='PRODUCTION_STOPPED'||error?.message===reason)throw error;
  throw Error(reason);
 }finally{if(handle)await handle.close();}
}
