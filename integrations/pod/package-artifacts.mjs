import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {MAX_PACKAGE_BYTES} from './artifacts.mjs';
import {PLATFORMS} from './policy.mjs';
import {parseSignedJSON} from './signed-json.mjs';

export const PACKAGE_MEDIA_TYPES=Object.freeze({
 'print.png':'image/png','art-mask.png':'image/png','text-mask.png':'image/png',
 'cover.pdf':'application/pdf','interior.pdf':'application/pdf',
 'interior.receipt.json':'application/json',
});
const BASE_FILES=Object.freeze(['art-mask.png','print.png','text-mask.png']);
const KDP_FILES=Object.freeze([...BASE_FILES,'cover.pdf','interior.pdf','interior.receipt.json'].sort());
const PNG_SIGNATURE=Buffer.from('89504e470d0a1a0a','hex');
const MAX_MANIFEST_BYTES=1024*1024;

function canonical(value){
 return Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
  value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
  JSON.stringify(value);
}

function topLevelMembers(payload){
 let position=0;
 const whitespace=()=>{while(/\s/.test(payload[position]||''))position++;};
 const stringEnd=start=>{
  if(payload[start]!=='"')throw Error('MANIFEST_INVALID');
  for(let index=start+1;index<payload.length;index++){
   if(payload[index]==='\\'){index++;continue;}
   if(payload[index]==='"')return index+1;
  }
  throw Error('MANIFEST_INVALID');
 };
 whitespace();if(payload[position++]!=='{')throw Error('MANIFEST_INVALID');
 whitespace();
 const members=new Map();
 if(payload[position]==='}'){position++;whitespace();if(position!==payload.length)throw Error('MANIFEST_INVALID');return members;}
 while(position<payload.length){
  const start=position,keyEnd=stringEnd(position),key=JSON.parse(payload.slice(position,keyEnd));
  if(members.has(key))throw Error('MANIFEST_INVALID');
  position=keyEnd;whitespace();if(payload[position++]!==':')throw Error('MANIFEST_INVALID');
  whitespace();const valueStart=position;let depth=0;
  while(position<payload.length){
   const char=payload[position];
   if(char==='"'){position=stringEnd(position);continue;}
   if(char==='{'||char==='['){depth++;position++;continue;}
   if(char===']'){if(depth<1)throw Error('MANIFEST_INVALID');depth--;position++;continue;}
   if(char==='}'){
    if(depth===0)break;
    depth--;position++;continue;
   }
   if(char===','&&depth===0)break;
   position++;
  }
  let valueEnd=position;while(valueEnd>valueStart&&/\s/.test(payload[valueEnd-1]))valueEnd--;
  if(valueEnd===valueStart)throw Error('MANIFEST_INVALID');
  members.set(key,{start,valueStart,valueEnd,end:valueEnd});
  whitespace();
  if(payload[position]===','){position++;whitespace();continue;}
  if(payload[position]==='}'){position++;whitespace();if(position!==payload.length)throw Error('MANIFEST_INVALID');return members;}
  throw Error('MANIFEST_INVALID');
 }
 throw Error('MANIFEST_INVALID');
}

function assertJSONBounds(value,state={nodes:0},depth=0){
 if(depth>64||++state.nodes>10000)throw Error('MANIFEST_INVALID');
 if(typeof value==='number'&&(!Number.isFinite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value))))throw Error('MANIFEST_INVALID');
 if(Array.isArray(value)){
  if(value.length>10000)throw Error('MANIFEST_INVALID');
  for(const item of value)assertJSONBounds(item,state,depth+1);
 }else if(value&&typeof value==='object'){
  const keys=Object.keys(value);if(keys.length>10000)throw Error('MANIFEST_INVALID');
  for(const key of keys)assertJSONBounds(value[key],state,depth+1);
 }
}

async function readRegularFile(file,maxBytes,reason){
 const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const info=await handle.stat();
  if(!info.isFile()||!Number.isSafeInteger(info.size)||info.size<1||info.size>maxBytes)throw Error(reason);
  const body=Buffer.alloc(info.size);let offset=0;
  while(offset<body.length){
   const {bytesRead}=await handle.read(body,offset,body.length-offset,offset);
   if(!bytesRead)throw Error(reason);offset+=bytesRead;
  }
  if((await handle.read(Buffer.alloc(1),0,1,offset)).bytesRead)throw Error(reason);
  return body;
 }finally{await handle.close();}
}

export async function readPackageManifest(directory,{platform,template,interiorTemplate,sourceSha256,textLayers,maxBytes=MAX_MANIFEST_BYTES}={}){
 if(!PLATFORMS.includes(platform)||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_MANIFEST_BYTES)throw Error('MANIFEST_INVALID');
 let base,candidate,file,body;
 try{
  base=await fs.realpath(directory);candidate=path.resolve(base,'manifest.json');file=await fs.realpath(candidate);
  if(!file.startsWith(base+path.sep))throw Error('MANIFEST_INVALID');
  body=await readRegularFile(candidate,maxBytes,'MANIFEST_INVALID');
 }catch(error){if(error.message==='MANIFEST_INVALID')throw error;throw Error('MANIFEST_INVALID');}
 let text,manifest;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(body);manifest=parseSignedJSON(text);}catch{throw Error('MANIFEST_INVALID');}
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw Error('MANIFEST_INVALID');
 assertJSONBounds(manifest);
 const hash=manifest.package_sha256;
 if(manifest.schema_version!==1||manifest.platform!==platform||manifest.publication_enabled!==false||
  !manifest.template||typeof manifest.template!=='object'||Array.isArray(manifest.template)||
  !/^[a-f0-9]{64}$/.test(hash||'')||!/^[a-f0-9]{64}$/.test(manifest.template_sha256||'')||
  !/^[a-f0-9]{64}$/.test(manifest.source_sha256||'')||
  !/^[a-f0-9]{64}$/.test(manifest.text_layers_sha256||'')||
  !Array.isArray(manifest.expected_text))throw Error('MANIFEST_INVALID');
 const payload=text.endsWith('\n')?text.slice(0,-1):text;
 const members=topLevelMembers(payload),packageMember=members.get('package_sha256'),templateMember=members.get('template');
 if(!packageMember||!templateMember)throw Error('MANIFEST_INVALID');
 const templateBytes=payload.slice(templateMember.valueStart,templateMember.valueEnd);
 if(crypto.createHash('sha256').update(templateBytes).digest('hex')!==manifest.template_sha256)throw Error('MANIFEST_TEMPLATE_HASH_MISMATCH');
 if(template!==undefined&&canonical(manifest.template)!==canonical(template))throw Error('MANIFEST_TEMPLATE_MISMATCH');
 if(sourceSha256!==undefined&&manifest.source_sha256!==sourceSha256)throw Error('MANIFEST_SOURCE_MISMATCH');
 if(textLayers!==undefined){
  if(!Array.isArray(textLayers)||manifest.text_layers_sha256!==crypto.createHash('sha256').update(canonical(textLayers)).digest('hex')||
   manifest.expected_text.length!==textLayers.length)throw Error('MANIFEST_TEXT_LAYERS_MISMATCH');
  for(let index=0;index<textLayers.length;index++){
   const expected=manifest.expected_text[index],source=textLayers[index];
   if(!expected||typeof expected!=='object'||Array.isArray(expected)||
    JSON.stringify(Object.keys(expected).sort())!==JSON.stringify(['box_px','font_sha256','text'])||
    !Array.isArray(expected.box_px)||expected.box_px.length!==4||expected.box_px.some(value=>!Number.isSafeInteger(value))||
    expected.text!==source?.text||expected.font_sha256!==source?.font_sha256)throw Error('MANIFEST_TEXT_LAYERS_MISMATCH');
  }
 }
 const unsigned=`{${[...members.entries()].filter(([key])=>key!=='package_sha256').map(([,member])=>payload.slice(member.start,member.end)).join(',')}}`;
 if(crypto.createHash('sha256').update(unsigned).digest('hex')!==hash)throw Error('MANIFEST_HASH_MISMATCH');
 if(platform==='kdp'){
  const interior=manifest.interior,receipt=interior?.receipt,files=manifest.files;
  if(!interiorTemplate||typeof interiorTemplate!=='object'||Array.isArray(interiorTemplate)||
   !interior||typeof interior!=='object'||Array.isArray(interior)||
   JSON.stringify(Object.keys(interior).sort())!==JSON.stringify(['receipt','template'])||
   !receipt||typeof receipt!=='object'||Array.isArray(receipt)||
   !files||typeof files!=='object'||Array.isArray(files)||
   !/^[a-f0-9]{64}$/.test(files['interior.pdf']||'')||
   !/^[a-f0-9]{64}$/.test(files['interior.receipt.json']||''))throw Error('MANIFEST_INTERIOR_MISMATCH');
  if(canonical(interior.template)!==canonical(interiorTemplate)||
   receipt.template_sha256!==crypto.createHash('sha256').update(canonical(interiorTemplate)).digest('hex')||
   receipt.interior_sha256!==files['interior.pdf']||receipt.schema_version!==1||
   receipt.page_count!==interiorTemplate.page_count||receipt.technical_checks_passed!==true||
   receipt.editorial_review!=='UNASSESSED'||receipt.production_ready!==false||
   receipt.publication_enabled!==false)throw Error('MANIFEST_INTERIOR_MISMATCH');
  let receiptBody,receiptText,storedReceipt;
  try{
   receiptBody=await readRegularFile(path.resolve(base,'interior.receipt.json'),maxBytes,'MANIFEST_INTERIOR_MISMATCH');
   receiptText=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(receiptBody);
   storedReceipt=parseSignedJSON(receiptText);
   assertJSONBounds(storedReceipt);
  }catch(error){if(error.message==='MANIFEST_INTERIOR_MISMATCH')throw error;throw Error('MANIFEST_INTERIOR_MISMATCH');}
  const receiptPayload=receiptText.endsWith('\n')?receiptText.slice(0,-1):receiptText;
  if(receiptPayload!==canonical(storedReceipt)||canonical(storedReceipt)!==canonical(receipt)||
   crypto.createHash('sha256').update(receiptBody).digest('hex')!==files['interior.receipt.json'])throw Error('MANIFEST_INTERIOR_MISMATCH');
 }
 return manifest;
}

export function assertPackageFormat(name,body){
 const mediaType=PACKAGE_MEDIA_TYPES[name];
 if(mediaType==='image/png'){
  const end=body.length-12;
  if(body.length<45||!body.subarray(0,8).equals(PNG_SIGNATURE)||
   body.readUInt32BE(8)!==13||body.subarray(12,16).toString('ascii')!=='IHDR'||
   end<33||body.readUInt32BE(end)!==0||body.subarray(end+4,end+8).toString('ascii')!=='IEND'){
   throw Error('ARTIFACT_INVALID');
  }
  return;
 }
 if(mediaType==='application/pdf'){
  let end=body.length;
  while(end&&[0,9,10,12,13,32].includes(body[end-1]))end--;
  if(!/^%PDF-(?:1\.[0-7]|2\.0)$/.test(body.subarray(0,8).toString('ascii'))||
   end<5||body.subarray(end-5,end).toString('ascii')!=='%%EOF')throw Error('ARTIFACT_INVALID');
  return;
 }
 try{
  // JSON package members can be persisted independently of the manifest
  // reader. Reject ambiguous bytes here as well so no caller can store a
  // duplicate-key, BOM-prefixed or numerically lossy receipt by hash alone.
  const value=parseSignedJSON(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body));
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
  assertJSONBounds(value);
 }catch{throw Error('ARTIFACT_INVALID');}
}

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
   assertPackageFormat(name,body);
   artifacts.push({body,mediaType:PACKAGE_MEDIA_TYPES[name]});
  }finally{await handle.close();}
 }
 return artifacts;
}
