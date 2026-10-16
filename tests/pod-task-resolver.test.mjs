import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
import {validateTask,createStoredTaskResolvers} from '../integrations/pod/task-resolver.mjs';
const sha='a'.repeat(64);
const task={schema_version:1,templateScope:{product:'fixture-shirt',country:'US'},files:{'input.json':sha},source:'input.json',template:'input.json',textLayers:'input.json',assetRights:'input.json',reference:'input.json'};
test('task descriptor blocks traversal and absent roles',()=>{
 assert.throws(()=>validateTask({...task,files:{'../escape':sha}}),/TASK_FILES_INVALID/);
 assert.throws(()=>validateTask({...task,source:'absent'}),/TASK_ROLE_INVALID/);
 for(const templateScope of [undefined,{}, {product:'',country:'US'}, {product:'shirt',country:'us'}]){
  assert.throws(()=>validateTask({...task,templateScope}),/TASK_TEMPLATE_SCOPE_REQUIRED/);
 }
});
test('generated output names are reserved before any input artifact is fetched',async()=>{
 for(const name of ['package','qa.json','qa-signed.json','PACKAGE','QA.JSON','QA-SIGNED.JSON']){
  const descriptor={...task,files:{...task.files,[name]:sha}};
  let reads=0;const store={get:async()=>{reads++;return {media_type:'application/json',body:Buffer.from(JSON.stringify(descriptor))};}};
  await assert.rejects(createStoredTaskResolvers({}, {store}).resolveTask({brief:{task_sha256:'b'.repeat(64)}}).then(async resolved=>{await resolved.cleanup();return resolved;}),/TASK_FILES_INVALID/);
  assert.equal(reads,1,'invalid descriptors must not restore input artifacts');
 }
});
test('interior accepts exactly three declared file roles and rejects unchecked paths',()=>{
 const valid={template:'input.json',pages:'input.json',font:'input.json'};
 for(const interior of [null,false,'input.json',[],{}, {...valid,font:'../font.ttf'},
  {...valid,extra:'../../outside'},{...valid,output:'package'},{...valid,extra:null}]){
  assert.throws(()=>validateTask({...task,interior}),/TASK_INTERIOR_INVALID/);
 }
 assert.equal(validateTask({...task,interior:valid}).interior,valid);
});
test('artifact identities must be strings rather than values coerced into hashes',async()=>{
 for(const value of [[sha],{toString:()=>sha},null,42]){
  assert.throws(()=>validateTask({...task,files:{'input.json':value}}),/TASK_FILES_INVALID/);
 }
 const resolver=createStoredTaskResolvers({}, {store:{get:async()=>{throw Error('must not fetch');}}});
 await assert.rejects(resolver.resolveTask({brief:{task_sha256:[sha]}}),/TASK_REQUIRED/);
});
test('valid interior restores only declared inputs while output destinations remain absent',async()=>{
 const descriptor={...task,interior:{template:'interior.json',pages:'pages.json',font:'font.ttf'},
  files:{...task.files,'interior.json':sha,'pages.json':sha,'font.ttf':sha}};
 const store={get:async hash=>hash==='b'.repeat(64)?{body:Buffer.from(JSON.stringify(descriptor)),media_type:'application/json'}:{body:Buffer.from('fixture'),media_type:'application/octet-stream'}};
 const resolved=await createStoredTaskResolvers({}, {store}).resolveTask({brief:{task_sha256:'b'.repeat(64)}});
 try{
  assert.deepEqual(Object.keys(resolved.interior),['template','pages','font']);
  for(const [role,filename] of Object.entries(descriptor.interior)){
   assert.equal(resolved.interior[role],path.join(resolved.assetRoot,filename));
   assert.equal(await fs.readFile(resolved.interior[role],'utf8'),'fixture');
  }
  for(const target of [resolved.output,resolved.qaOutput,resolved.qaSignedOutput])await assert.rejects(fs.stat(target),{code:'ENOENT'});
 }finally{await resolved.cleanup();}
 await assert.rejects(fs.stat(resolved.assetRoot),{code:'ENOENT'});
});
test('production blocks colliding inputs before Python and records only a fixed reason',async()=>{
 const key='synthetic-key-'.repeat(4),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH',task_sha256:'b'.repeat(64)};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,task_sha256:brief.task_sha256});
 let stored,reads=0;
 const store={get:async()=>{reads++;return {media_type:'application/json',body:Buffer.from(JSON.stringify({...task,files:{...task.files,package:sha}}))};}};
 const result=await produceOnce({upstreamKey:key,env:{POD_PRODUCTION_ENABLED:'true',PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'},
  db:{claimProduction:async()=>({id:'j',brief}),failProduction:async(_job,reason)=>stored=reason,
   assertProducible:async()=>{throw Error('must not reach production authorization');}},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:createStoredTaskResolvers({}, {store}).resolveTask});
 assert.deepEqual(result,{status:'BLOCKED',job_id:'j',reason_code:'TASK_FILES_INVALID'});
 assert.equal(stored,'TASK_FILES_INVALID');assert.equal(reads,1);
});
test('resolver restores stored bytes into isolated disposable workspace',async()=>{
 const descriptor=Buffer.from(JSON.stringify({...task,approvedEditorialEvaluators:['descriptor-cannot-authorize']}));
 const store={get:async hash=>hash==='b'.repeat(64)?{body:descriptor,media_type:'application/json'}:{body:Buffer.from('payload'),media_type:'application/json'}};
 const resolver=createStoredTaskResolvers({}, {store});
 const resolved=await resolver.resolveTask({brief:{task_sha256:'b'.repeat(64)}});
 assert.equal(await fs.readFile(resolved.source,'utf8'),'payload');
 assert.equal(resolved.reviewPackage,undefined);
 assert.deepEqual(resolved.approvedEditorialEvaluators,[]);
 assert.deepEqual(resolved.templateScope,task.templateScope);
 await resolved.cleanup();await assert.rejects(fs.stat(resolved.assetRoot),{code:'ENOENT'});
 const authorized=createStoredTaskResolvers({}, {store,approvedEditorialEvaluators:['host-fixture']});
 const approved=await authorized.resolveTask({brief:{task_sha256:'b'.repeat(64)}});
 try{assert.deepEqual(approved.approvedEditorialEvaluators,['host-fixture']);}finally{await approved.cleanup();}
});
