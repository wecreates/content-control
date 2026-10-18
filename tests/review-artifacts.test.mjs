import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createReviewArtifactVerifier,readReviewJson} from '../review-artifacts.js';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fixture(fn){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'review-artifacts-'));
 await fs.mkdir(path.join(root,'reference/frames'),{recursive:true});
 const review={reference_frames:[]};
 for(let i=0;i<4;i++){
  const relative=`reference/frames/ref-${i}.jpg`,bytes='reference '+i;
  await fs.writeFile(path.join(root,relative),bytes);review.reference_frames.push({path:relative,sha256:hash(bytes)});
 }
 try{await fn({root,review,artifacts:createReviewArtifactVerifier(root)});}
 finally{await fs.rm(root,{recursive:true,force:true});}
}
test('unchanged references verify repeatedly; cached digest is invalidated by same-size edit with restored mtime',()=>fixture(async({root,review,artifacts})=>{
 await artifacts.references(review);await artifacts.references(review);
 const file=path.join(root,review.reference_frames[0].path),before=await fs.stat(file);
 await fs.writeFile(file,'reference X');await fs.utimes(file,before.atime,before.mtime);
 await assert.rejects(artifacts.references(review),/reference_changed/);
}));
test('removed, extra and duplicate reference sets fail closed',async()=>{
 for(const change of [
  async({root,review})=>fs.rm(path.join(root,review.reference_frames[0].path)),
  async({root})=>fs.writeFile(path.join(root,'reference/frames/ref-extra.jpg'),'extra'),
  async({review})=>{review.reference_frames[1]={...review.reference_frames[0]};},
  async({review})=>{delete review.reference_frames;},
 ])await fixture(async value=>{await change(value);await assert.rejects(value.artifacts.references(value.review));});
});
test('traversal, symlink and oversized reference artifacts fail closed',async()=>{
 for(const change of [
  async({review})=>{review.reference_frames[0].path='../ref-0.jpg';},
  async({root,review})=>{const file=path.join(root,review.reference_frames[0].path);await fs.rm(file);await fs.symlink(path.join(root,review.reference_frames[1].path),file);},
  async({root,review})=>{const handle=await fs.open(path.join(root,review.reference_frames[0].path),'w');try{await handle.truncate(8*1024*1024+1);}finally{await handle.close();}},
 ])await fixture(async value=>{await change(value);await assert.rejects(value.artifacts.references(value.review));});
});
test('a declared character board must retain its exact identity',()=>fixture(async({root,review,artifacts})=>{
 const relative='reference/characters/content-control-character-board.svg';
 await fs.mkdir(path.dirname(path.join(root,relative)),{recursive:true});await fs.writeFile(path.join(root,relative),'<svg/>');
 review.character_board={path:relative,sha256:hash('<svg/>')};await artifacts.references(review);
 await fs.writeFile(path.join(root,relative),'<svg>changed</svg>');await assert.rejects(artifacts.references(review),/character_board_changed/);
}));
test('candidate digest and JSON readers enforce type, nonempty and size bounds',()=>fixture(async({root,artifacts})=>{
 await fs.writeFile(path.join(root,'candidate'),'abc');
 assert.equal((await artifacts.digest('candidate',3)).sha256,hash('abc'));
 await assert.rejects(artifacts.digest('candidate',2),/artifact_size/);
 await fs.writeFile(path.join(root,'candidate'),'');await assert.rejects(artifacts.digest('candidate',3),/artifact_size/);
 for(const text of ['[]','null','{bad',' '.repeat(512*1024+1)]){
  await fs.writeFile(path.join(root,'review.json'),text);await assert.rejects(readReviewJson(root,'review.json'));
 }
}));
