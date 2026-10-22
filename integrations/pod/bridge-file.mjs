import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {parseSignedJSON} from './signed-json.mjs';
import {assertBridge} from './policy.mjs';

export const MAX_BRIDGE_BYTES=64*1024;

export function parseBridgeJSON(body){
 try{
  const bytes=typeof body==='string'?Buffer.from(body):body;
  if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>MAX_BRIDGE_BYTES)
   throw Error('BRIDGE_CONTRACT_INVALID');
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  if(typeof body==='string'&&text!==body)throw Error('BRIDGE_CONTRACT_INVALID');
  const bridge=parseSignedJSON(text);
  assertBridge(bridge);
  return bridge;
 }catch(error){
  if(error?.message==='BRIDGE_CONTRACT_INVALID')throw error;
  throw Error('BRIDGE_CONTRACT_INVALID');
 }
}

export async function readBridgeFile(filename,{signal}={}){
 const active=()=>{if(signal?.aborted)throw Error('BRIDGE_CONTRACT_INVALID');};
 let handle;
 try{
  active();
  if(typeof filename!=='string'||!filename)throw Error('BRIDGE_CONTRACT_INVALID');
  handle=await fs.open(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  active();
  const stat=await handle.stat();
  if(!stat.isFile()||!Number.isSafeInteger(stat.size)||stat.size<1||stat.size>MAX_BRIDGE_BYTES)
   throw Error('BRIDGE_CONTRACT_INVALID');
  const body=Buffer.alloc(stat.size);let offset=0;
  while(offset<body.length){
   active();
   const {bytesRead}=await handle.read(body,offset,body.length-offset,offset);
   if(!bytesRead)throw Error('BRIDGE_CONTRACT_INVALID');
   offset+=bytesRead;
  }
  active();
  if((await handle.read(Buffer.alloc(1),0,1,offset)).bytesRead)throw Error('BRIDGE_CONTRACT_INVALID');
  return parseBridgeJSON(body);
 }catch(error){
  if(error?.message==='BRIDGE_CONTRACT_INVALID')throw error;
  throw Error('BRIDGE_CONTRACT_INVALID');
 }finally{if(handle)await handle.close();}
}
