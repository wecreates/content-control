import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const source=fs.readFileSync(path.join(root,'server-lowmem.js'),'utf8');
const start=source.indexOf('function fileIdentity(');
const functions=source.slice(start<0?source.indexOf('function readJson('):start,source.indexOf('function episode2Acceptance('));
function child(code,args=[]){
 const result=spawnSync(process.execPath,['--input-type=module','-e',code,...args],{cwd:root,encoding:'utf8',timeout:1500});
 assert.equal(result.error,undefined,`Reader must finish without blocking: ${result.error}`);
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
function fixture(fn){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'regular-file-readers-'));
 try{return fn(directory);}finally{fs.rmSync(directory,{recursive:true,force:true});}
}
test('hosted sync readers reject FIFO and FIFO symlinks without blocking',()=>fixture(directory=>{
 const fifo=path.join(directory,'input.pipe'),alias=path.join(directory,'input-link');
 const made=spawnSync('mkfifo',[fifo]);assert.equal(made.status,0);fs.symlinkSync(fifo,alias);
 for(const target of [fifo,alias]){
  const code=`import fs from 'node:fs';import crypto from 'node:crypto';import vm from 'node:vm';const functions=${JSON.stringify(functions)};console.log(JSON.stringify(vm.runInNewContext(functions+'\\n[readJson(target),fileHash(target)]',{fs,crypto,Buffer,target:process.argv[1]})));`;
  assert.deepEqual(child(code,[target]),[null,null]);
 }
}));
test('async artifact readers reject FIFO and FIFO symlinks before any stream read',()=>fixture(directory=>{
 const fifo=path.join(directory,'input.pipe'),alias=path.join(directory,'input-link');
 assert.equal(spawnSync('mkfifo',[fifo]).status,0);fs.symlinkSync(fifo,alias);
 const code="import {createReviewArtifactVerifier,readReviewJson} from './review-artifacts.js';const root=process.argv[1],name=process.argv[2];const results=await Promise.allSettled([createReviewArtifactVerifier(root).digest(name,1024),readReviewJson(root,name),readReviewJson(root,name,{allowRegularSymlink:true})]);console.log(JSON.stringify(results.map(x=>x.status)));";
 for(const name of ['input.pipe','input-link'])assert.deepEqual(child(code,[directory,name]),['rejected','rejected','rejected']);
}));
test('production status routes fail closed on FIFO source files',()=>fixture(directory=>{
 for(const relative of ['state/v2-production-status.json','state/v2-revalidation.json','state/production-execution/long.json']){
  const target=path.join(directory,relative);fs.mkdirSync(path.dirname(target),{recursive:true});assert.equal(spawnSync('mkfifo',[target]).status,0);
 }
 const code="import express from 'express';import {createProductionStatusRouter} from './production-status.js';const app=express();app.use(createProductionStatusRouter({root:process.argv[1]}));const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;const results=[];for(const route of ['/v2','/v2/revalidation','/execution/long']){const r=await fetch(base+route),data=await r.json();results.push([r.status,data.production_approved]);}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(results));";
 assert.deepEqual(child(code,[directory]),[[503,false],[503,false],[503,false]]);
}));
test('sync readers preserve ordinary files and regular symlinks while bounding empty and oversized inputs',()=>fixture(directory=>{
 const ordinary=path.join(directory,'ordinary.json'),alias=path.join(directory,'regular-link');fs.writeFileSync(ordinary,'{"ok":true}');fs.symlinkSync(ordinary,alias);
 const context={fs,crypto,Buffer};vm.createContext(context);vm.runInContext(functions,context);
 for(const target of [ordinary,alias]){
  assert.equal(context.readJson(target).ok,true);
  assert.equal(context.fileHash(target),crypto.createHash('sha256').update('{"ok":true}').digest('hex'));
 }
 const empty=path.join(directory,'empty');fs.writeFileSync(empty,'');
 for(const target of [empty,path.join(directory,'missing'),directory]){assert.equal(context.readJson(target),null);assert.equal(context.fileHash(target),null);}
 const oversized=path.join(directory,'oversized');fs.writeFileSync(oversized,'');fs.truncateSync(oversized,512*1024+1);assert.equal(context.readJson(oversized),null);
 fs.truncateSync(oversized,512*1024*1024+1);assert.equal(context.fileHash(oversized),null);
}));
test('status routes preserve regular report symlinks while strict review JSON retains its prior policy',()=>fixture(directory=>{
 const report={schema_version:1,run_id:123,run_attempt:1,recorded_at:new Date().toISOString(),source_commit:'a'.repeat(40),format:'long',candidate_sha256:null,technical_status:'BLOCKED',publication_enabled:false,production_approved:false,checks:{}};
 const actual=path.join(directory,'report.json');fs.writeFileSync(actual,JSON.stringify(report));
 for(const relative of ['state/v2-production-status.json','state/production-execution/long.json']){
  const target=path.join(directory,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.symlinkSync(actual,target);
 }
 const code="import express from 'express';import {createProductionStatusRouter} from './production-status.js';import {readReviewJson} from './review-artifacts.js';const root=process.argv[1],app=express();app.use(createProductionStatusRouter({root}));const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const results=[];for(const route of ['/v2','/execution/long']){const r=await fetch('http://127.0.0.1:'+server.address().port+route);await r.json();results.push(r.status);}try{await readReviewJson(root,'state/v2-production-status.json');results.push('unexpected');}catch{results.push('strict_rejected');}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(results));";
 assert.deepEqual(child(code,[directory]),[200,200,'strict_rejected']);
}));
