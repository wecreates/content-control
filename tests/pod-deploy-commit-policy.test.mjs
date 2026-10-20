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
  ['state/system-completion.json'],['state/operations-snapshot.json'],
  ['state/workflow-control-health.json'],['state/system-wiring-health.json'],['state/deployment-health.json'],
  ['scripts/pod_production_worker.mjs'],['POD_IMPLEMENTATION_STATUS.md','package-lock.json']]){
  assert.equal(renderCommitMessage('Change',paths),'Change');
 }
});
test('watchdog observations alone skip Render but every mixed runtime change deploys',()=>{
 const report='state/free-production-watchdog.json';
 assert.equal(renderCommitMessage('Update free production watchdog evidence',[report]),
  'Update free production watchdog evidence [skip render]');
 for(const other of ['state/content-control-health.json','state/operations-snapshot.json',
  'server-lowmem.js','render.yaml','package-lock.json','state/free-production-watchdog.json.bak']){
  assert.equal(renderCommitMessage('Update watchdog',[report,other]),'Update watchdog');
 }
});
test('watchdog workflow uses staged policy for real report-only and mixed commits',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-watchdog-commit-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
 try{
  git('init','--quiet');git('config','user.name','Synthetic Test');git('config','user.email','fixture@example.invalid');
  await fs.mkdir(path.join(root,'state'));await fs.mkdir(path.join(root,'scripts'));
  await fs.copyFile(new URL('../scripts/pod_deploy_commit_policy.mjs',import.meta.url),path.join(root,'scripts/pod_deploy_commit_policy.mjs'));
  await fs.writeFile(path.join(root,'state/free-production-watchdog.json'),'{}\n');
  git('add','.');git('commit','--quiet','-m','Fixture baseline');
  const workflow=await fs.readFile(new URL('../.github/workflows/free-production-watchdog.yml',import.meta.url),'utf8');
  const line=workflow.split('\n').find(line=>line.includes('git diff --cached --quiet || git commit -m'));
  assert.ok(line?.includes('pod_deploy_commit_policy.mjs'));
  await fs.writeFile(path.join(root,'state/free-production-watchdog.json'),'{"status":"REPAIR_REQUIRED"}\n');
  git('add','state/free-production-watchdog.json');
  execFileSync('bash',['-eu','-c',line.trim()],{cwd:root,encoding:'utf8'});
  assert.equal(git('log','-1','--format=%s').trim(),'Update free production watchdog evidence [skip render]');
  await fs.writeFile(path.join(root,'state/free-production-watchdog.json'),'{"status":"UNKNOWN"}\n');
  await fs.writeFile(path.join(root,'state/content-control-health.json'),'fixture runtime health');
  git('add','state');
  execFileSync('bash',['-eu','-c',line.trim()],{cwd:root,encoding:'utf8'});
  assert.equal(git('log','-1','--format=%s').trim(),'Update free production watchdog evidence');
  const head=git('rev-parse','HEAD');
  execFileSync('bash',['-eu','-c',line.trim()],{cwd:root,encoding:'utf8'});
  assert.equal(git('rev-parse','HEAD'),head);
  git('mv','state/content-control-health.json','POD_FREE_DEPLOYMENT.md');
  assert.equal(stagedRenderCommitMessage('Move runtime health',{cwd:root}),'Move runtime health');
 }finally{await fs.rm(root,{recursive:true,force:true});}
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
