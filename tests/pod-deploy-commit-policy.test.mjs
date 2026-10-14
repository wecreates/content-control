import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {REPORT_ONLY_PATHS,renderCommitMessage,stagedRenderCommitMessage} from '../scripts/pod_deploy_commit_policy.mjs';

test('only explicitly named report paths can skip Render, not GitHub CI',()=>{
 for(const name of REPORT_ONLY_PATHS)assert.equal(renderCommitMessage('Record evidence',[name]),'Record evidence [skip render]');
 assert.equal(renderCommitMessage('Record evidence',[...REPORT_ONLY_PATHS]),'Record evidence [skip render]');
});
test('runtime mixed unknown and empty changes preserve deployment',()=>{
 for(const paths of [[],['server-lowmem.js'],['Dockerfile'],['render.yaml'],['state/unknown.json'],
  ['state/content-control-health.json'],['public-review/new.png'],['migrations/001_pod.sql'],
  ['scripts/pod_production_worker.mjs'],['POD_IMPLEMENTATION_STATUS.md','package-lock.json']]){
  assert.equal(renderCommitMessage('Change',paths),'Change');
 }
});
test('caller-supplied skip instructions and malformed lists fail closed',()=>{
 for(const message of ['', 'text\n[skip render]', 'Change [skip render]', 'Change [deploy skip]', 'Change [skip cd]']){
  assert.throws(()=>renderCommitMessage(message,['server-lowmem.js']),/COMMIT_MESSAGE_INVALID/);
 }
 for(const changes of [null,'POD_IMPLEMENTATION_STATUS.md',[null],['']]){
  assert.throws(()=>renderCommitMessage('Change',changes),/CHANGE_LIST_INVALID/);
 }
});
test('actual staged changes include both sides of a runtime-to-report rename',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-commit-policy-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
 try{
  git('init','--quiet');git('config','user.name','Synthetic Test');git('config','user.email','fixture@example.invalid');
  await fs.writeFile(path.join(root,'server-lowmem.js'),'fixture runtime bytes');
  git('add','server-lowmem.js');git('commit','--quiet','-m','Fixture baseline');
  await fs.writeFile(path.join(root,'POD_IMPLEMENTATION_STATUS.md'),'fixture evidence');
  git('add','POD_IMPLEMENTATION_STATUS.md');
  assert.equal(stagedRenderCommitMessage('Record evidence',{cwd:root}),'Record evidence [skip render]');
  // Exercise the actual workflow shell expression, not only the JS function.
  const workflow=await fs.readFile(new URL('../.github/workflows/runtime-provenance.yml',import.meta.url),'utf8');
  const line=workflow.split('\n').find(line=>line.includes('git diff --cached --quiet || git commit -m'));
  assert.ok(line?.includes('pod_deploy_commit_policy.mjs'));
  await fs.mkdir(path.join(root,'scripts'));
  await fs.copyFile(new URL('../scripts/pod_deploy_commit_policy.mjs',import.meta.url),path.join(root,'scripts/pod_deploy_commit_policy.mjs'));
  execFileSync('bash',['-eu','-c',line.trim()],{cwd:root,encoding:'utf8'});
  assert.equal(git('log','-1','--format=%s').trim(),'Update hash-bound runtime provenance and SBOM [skip render]');
  git('mv','server-lowmem.js','POD_FREE_DEPLOYMENT.md');
  assert.equal(stagedRenderCommitMessage('Move file',{cwd:root}),'Move file');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
