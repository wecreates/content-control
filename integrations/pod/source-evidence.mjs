import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import crypto from 'node:crypto';
import {parseSignedJSON} from './signed-json.mjs';
import {verifyEnvelope} from './policy.mjs';

const MAX_SOURCE_BYTES=16*1024*1024;
const MAX_RIGHTS_BYTES=4*1024*1024;
const MAX_TEXT_LAYERS_BYTES=4*1024*1024;

function canonical(value){
 return Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
  value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
  JSON.stringify(value);
}

function assertJSONBounds(value,state={nodes:0},depth=0){
 if(depth>64||++state.nodes>10000)throw Error('TEXT_LAYERS_INVALID');
 if(typeof value==='number'&&(!Number.isFinite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value))))throw Error('TEXT_LAYERS_INVALID');
 if(Array.isArray(value)){
  if(value.length>10000)throw Error('TEXT_LAYERS_INVALID');
  for(const item of value)assertJSONBounds(item,state,depth+1);
 }else if(value&&typeof value==='object'){
  const keys=Object.keys(value);if(keys.length>10000)throw Error('TEXT_LAYERS_INVALID');
  for(const key of keys)assertJSONBounds(value[key],state,depth+1);
 }
}

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
async function verify(sourceFilename,rightsFilename,key,{signal,textLayersFilename}={}){
 const active=()=>{if(signal?.aborted)throw Error('PRODUCTION_STOPPED');};
 active();
 const source=await snapshot(sourceFilename,MAX_SOURCE_BYTES,'SOURCE_BYTES_INVALID',active);
 const rightsBytes=await snapshot(rightsFilename,MAX_RIGHTS_BYTES,'SOURCE_RIGHTS_INVALID',active);
 const textLayersBytes=textLayersFilename===undefined?null:
  await snapshot(textLayersFilename,MAX_TEXT_LAYERS_BYTES,'TEXT_LAYERS_INVALID',active);
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
 let textLayers,textLayersSha256;
 if(textLayersBytes){
  try{
   const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(textLayersBytes);
   textLayers=parseSignedJSON(text);assertJSONBounds(textLayers);
  }catch(error){if(error?.message==='PRODUCTION_STOPPED')throw error;throw Error('TEXT_LAYERS_INVALID');}
  if(!Array.isArray(textLayers)||textLayers.some(layer=>
   !layer||typeof layer!=='object'||Array.isArray(layer)||typeof layer.text!=='string'||
   !/^[a-f0-9]{64}$/.test(layer.font_sha256||'')))throw Error('TEXT_LAYERS_INVALID');
  textLayersSha256=crypto.createHash('sha256').update(canonical(textLayers)).digest('hex');
  if(rights.text_layers_sha256!==textLayersSha256)throw Error('TEXT_LAYERS_HASH_MISMATCH');
 }
 active();
 return {sourceSha256,textLayers,textLayersSha256};
}

export async function verifySourceEvidence(sourceFilename,rightsFilename,key,options={}){
 return (await verify(sourceFilename,rightsFilename,key,options)).sourceSha256;
}

export async function verifyProductionSourceEvidence(sourceFilename,rightsFilename,textLayersFilename,key,options={}){
 return verify(sourceFilename,rightsFilename,key,{...options,textLayersFilename});
}
