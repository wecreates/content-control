import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {constants} from 'node:fs';
import {parseSignedJSON} from './signed-json.mjs';
const MAGIC=Buffer.from('CYZPOD1\n');
const DIRECTORY_FLAGS=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW;
const identity=stat=>`${stat.dev}:${stat.ino}`;
export function validArchiveTimestamp(value){
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/.test(value))return false;
 const milliseconds=Date.parse(value);
 return Number.isSafeInteger(milliseconds)&&milliseconds>=0&&new Date(milliseconds).toISOString()===value;
}
export function parseArchiveJSON(body,reason='ARCHIVE_INVALID'){
 try{
  if(!Buffer.isBuffer(body)||!body.length)throw Error(reason);
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body);
  return parseSignedJSON(text);
 }catch{throw Error(reason);}
}
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
export async function openArchiveDirectory(directory,reason='ARCHIVE_DIRECTORY_INVALID'){
 let handle;
 try{
  handle=await fs.open(directory,DIRECTORY_FLAGS);
  const opened=await handle.stat(),base=`/proc/self/fd/${handle.fd}`,alias=await fs.stat(base);
  if(!opened.isDirectory()||!alias.isDirectory()||identity(alias)!==identity(opened))throw Error(reason);
  return {base,handle,identity:identity(opened)};
 }catch(error){
  if(handle)try{await handle.close();}catch{}
  if(error.message===reason)throw error;
  throw Error(reason);
 }
}
export async function createArchiveDirectory(directory,reason='ARCHIVE_DIRECTORY_INVALID'){
 const archive=path.resolve(directory),parentPath=path.dirname(archive),name=path.basename(archive);
 let parentHandle,handle,created=false;
 try{
  parentHandle=await fs.open(parentPath,DIRECTORY_FLAGS);
  const parentOpened=await parentHandle.stat(),parentBase=`/proc/self/fd/${parentHandle.fd}`,parentAlias=await fs.stat(parentBase);
  if(!parentOpened.isDirectory()||!parentAlias.isDirectory()||identity(parentAlias)!==identity(parentOpened))throw Error(reason);
  await fs.mkdir(path.join(parentBase,name),{mode:0o700});created=true;
  handle=await fs.open(path.join(parentBase,name),DIRECTORY_FLAGS);
  const opened=await handle.stat(),base=`/proc/self/fd/${handle.fd}`,alias=await fs.stat(base);
  if(!opened.isDirectory()||!alias.isDirectory()||identity(alias)!==identity(opened))throw Error(reason);
  const result={base,handle,parentHandle,identity:identity(opened),parentIdentity:identity(parentOpened)};
  await assertArchiveDirectory(archive,result,reason);
  return result;
 }catch(error){
  if(handle)try{await handle.close();}catch{}
  if(parentHandle)try{await parentHandle.close();}catch{}
  if(!created)throw error;
  if(error.message===reason)throw error;
  throw Error(reason);
 }
}
export async function assertArchiveDirectory(directory,opened,reason='ARCHIVE_DIRECTORY_INVALID'){
 let current,parent;
 try{
  current=await fs.lstat(directory);
  if(opened.parentIdentity)parent=await fs.lstat(path.dirname(path.resolve(directory)));
 }catch{throw Error(reason);}
 if(!current.isDirectory()||identity(current)!==opened.identity)throw Error(reason);
 // Export durability depends on fsyncing the same parent that still contains
 // the archive. Moving the pinned archive inode beneath a replacement parent
 // must not turn a flush of the old parent into a successful receipt.
 if(opened.parentIdentity&&(!parent.isDirectory()||identity(parent)!==opened.parentIdentity))throw Error(reason);
}
export async function syncArchiveDirectory(directory,opened){
 // Files have already been fsynced. Persist their directory entries first,
 // then the new archive directory's entry in its existing parent. Neither
 // failure may be reported as a successful export.
 await opened.handle.sync();
 if(opened.parentHandle){await opened.parentHandle.sync();return;}
 const parentHandle=await fs.open(path.dirname(path.resolve(directory)),DIRECTORY_FLAGS);
 try{await parentHandle.sync();}finally{await parentHandle.close();}
}
export async function closeArchiveDirectory(opened){
 try{await opened.handle.close();}finally{if(opened.parentHandle)await opened.parentHandle.close();}
}
