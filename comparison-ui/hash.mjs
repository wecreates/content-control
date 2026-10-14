// Bounded-memory local SHA-256. No bytes leave the device.
import {sha256} from './vendor/noble-hashes/sha2.js';
export const HASH_CHUNK_BYTES=1024*1024;
export async function fileIdentity(file){
 if(!Number.isSafeInteger(file?.size)||file.size<0||typeof file.slice!=='function')throw Error('A readable local file is required.');
 const hash=sha256.create();
 try{
  for(let offset=0;offset<file.size;offset+=HASH_CHUNK_BYTES){
   const bytes=new Uint8Array(await file.slice(offset,Math.min(file.size,offset+HASH_CHUNK_BYTES)).arrayBuffer());
   if(bytes.length!==Math.min(HASH_CHUNK_BYTES,file.size-offset))throw Error('Incomplete file read.');
   hash.update(bytes);
  }
  return {sha256:hash.digest().reduce((s,b)=>s+b.toString(16).padStart(2,'0'),''),byte_length:file.size,identity_verified:true};
 }finally{hash.destroy();}
}
