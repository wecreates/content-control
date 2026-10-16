import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {constants} from 'node:fs';
const MAGIC=Buffer.from('CYZPOD1\n');
export function seal(body,key,aad){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(aad));const data=Buffer.concat([cipher.update(body),cipher.final()]);
 return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),data]);
}
export function unseal(body,key,aad){
 if(body.length<36||!body.subarray(0,8).equals(MAGIC))throw Error('ARCHIVE_INVALID');
 const cipher=crypto.createDecipheriv('aes-256-gcm',key,body.subarray(8,20));
 cipher.setAAD(Buffer.from(aad));cipher.setAuthTag(body.subarray(20,36));
 try{return Buffer.concat([cipher.update(body.subarray(36)),cipher.final()]);}catch{throw Error('ARCHIVE_AUTH_FAILED');}
}
export async function readBounded(file,max,signal){
 signal?.throwIfAborted();
 // O_NOFOLLOW alone still blocks forever when the named entry is a FIFO.
 const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const stat=await handle.stat();if(!stat.isFile()||stat.size>max||stat.size<36)throw Error('ARCHIVE_SIZE_INVALID');
  const body=Buffer.alloc(stat.size);let offset=0;
  while(offset<body.length){signal?.throwIfAborted();const {bytesRead}=await handle.read(body,offset,body.length-offset,null);if(!bytesRead)throw Error('ARCHIVE_TRUNCATED');offset+=bytesRead;}
  if((await handle.read(Buffer.alloc(1),0,1,null)).bytesRead)throw Error('ARCHIVE_SIZE_INVALID');
  signal?.throwIfAborted();
  return body;
 }finally{await handle.close();}
}
export async function writeNew(file,body){
 const handle=await fs.open(file,'wx',0o600);
 try{await handle.writeFile(body);await handle.sync();}finally{await handle.close();}
}
export async function syncArchiveDirectory(directory){
 // Files have already been fsynced. Persist their directory entries first,
 // then the new archive directory's entry in its existing parent. Neither
 // failure may be reported as a successful export.
 const archive=path.resolve(directory);
 for(const target of [archive,path.dirname(archive)]){
  const handle=await fs.open(target,'r');
  try{await handle.sync();}finally{await handle.close();}
 }
}
