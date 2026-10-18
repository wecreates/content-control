import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';

// Metadata identities invalidate cached digests on replacement and in-place
// edits. Hash through the same open descriptor, with bounded memory and bytes.
const identity=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');
const SHA256=/^[a-f0-9]{64}$/;
export function createReviewArtifactVerifier(root){
 const cache=new Map();
 async function digest(relative,maxBytes){
  const file=path.join(root,relative);
  const handle=await fs.open(file,constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW);
  try{
   const before=await handle.stat({bigint:true});
   if(!before.isFile()||before.size<=0n||before.size>BigInt(maxBytes))throw Error('artifact_size');
   const key=identity(before),known=cache.get(relative);
   if(known?.identity===key){
    if(identity(await fs.lstat(file,{bigint:true}))!==key)throw Error('artifact_changed');
    return {sha256:known.sha256,size:Number(before.size)};
   }
   const hash=crypto.createHash('sha256');let size=0;
   for await(const chunk of handle.createReadStream({autoClose:false,highWaterMark:64*1024})){
    size+=chunk.length;if(size>maxBytes)throw Error('artifact_size');hash.update(chunk);
   }
   if(size!==Number(before.size)||identity(await handle.stat({bigint:true}))!==key||identity(await fs.lstat(file,{bigint:true}))!==key)throw Error('artifact_changed');
   const sha256=hash.digest('hex');
   if(cache.size>=258)cache.delete(cache.keys().next().value);
   cache.set(relative,{identity:key,sha256});
   return {sha256,size};
  }finally{await handle.close();}
 }
 async function references(review){
  const entries=review?.reference_frames;
  if(!Array.isArray(entries)||entries.length<4||entries.length>256)throw Error('reference_set');
  const directory='reference/frames';
  const files=(await fs.readdir(path.join(root,directory),{withFileTypes:true})).filter(entry=>/^ref-.*\.jpg$/.test(entry.name));
  if(files.length!==entries.length||files.some(entry=>!entry.isFile()))throw Error('reference_set');
  const names=new Set(files.map(entry=>entry.name)),seen=new Set();let total=0;
  for(const entry of entries){
   if(!entry||typeof entry.path!=='string'||typeof entry.sha256!=='string'||!SHA256.test(entry.sha256))throw Error('reference_identity');
   const name=path.basename(entry.path);
   if(entry.path!==`${directory}/${name}`||!names.has(name)||seen.has(name))throw Error('reference_path');
   seen.add(name);
   const current=await digest(`${directory}/${name}`,8*1024*1024);total+=current.size;
   if(total>64*1024*1024||current.sha256!==entry.sha256)throw Error('reference_changed');
  }
  // The canonical review also binds character identity to this board when used.
  if(review.character_board!==undefined){
   const board=review.character_board;
   if(board?.path!=='reference/characters/content-control-character-board.svg'||typeof board.sha256!=='string'||!SHA256.test(board.sha256))throw Error('character_board');
   if((await digest(board.path,8*1024*1024)).sha256!==board.sha256)throw Error('character_board_changed');
  }
 }
 return {digest,references};
}

export async function readReviewJson(root,relative,{allowRegularSymlink=false}={}){
 const file=path.join(root,relative);
 const handle=await fs.open(file,constants.O_RDONLY|constants.O_NONBLOCK|(allowRegularSymlink?0:constants.O_NOFOLLOW));
 try{
  const stat=await handle.stat({bigint:true});
  if(!stat.isFile()||stat.size<=0n||stat.size>512n*1024n)throw Error('review_json_size');
  const chunks=[];let size=0;
  for await(const chunk of handle.createReadStream({autoClose:false,highWaterMark:64*1024})){
   size+=chunk.length;if(size>512*1024)throw Error('review_json_size');chunks.push(chunk);
  }
  const current=allowRegularSymlink?await fs.stat(file,{bigint:true}):await fs.lstat(file,{bigint:true});
  if(size!==Number(stat.size)||identity(await handle.stat({bigint:true}))!==identity(stat)||identity(current)!==identity(stat))throw Error('review_json_changed');
  const bytes=Buffer.concat(chunks),value=JSON.parse(bytes);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('review_json_object');
  return {bytes,value};
 }finally{await handle.close();}
}
