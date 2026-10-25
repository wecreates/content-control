import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
import {validateTask,createStoredTaskResolvers} from '../integrations/pod/task-resolver.mjs';
const hashes={image:'a'.repeat(64),descriptor:'b'.repeat(64),json:'c'.repeat(64),zip:'d'.repeat(64),font:'e'.repeat(64),text:'f'.repeat(64)};
const sha=hashes.image;
const task={schema_version:1,templateScope:{product:'fixture-shirt',country:'US'},
 files:{'source.png':hashes.image,'input.json':hashes.json},source:'source.png',template:'input.json',
 textLayers:'input.json',assetRights:'input.json',reference:'source.png'};
const mediaType=id=>id===hashes.image?'image/png':id===hashes.zip?'application/zip':
 id===hashes.font?'font/ttf':id===hashes.text?'text/plain':'application/json';
const artifact=(id,body='fixture')=>({body:Buffer.from(body),media_type:mediaType(id)});

test('cancelled task restoration performs no descriptor read',async()=>{
 const controller=new AbortController();controller.abort(Error('private cancellation detail'));
 let reads=0;
 const resolver=createStoredTaskResolvers({}, {store:{get:async()=>{reads++;throw Error('unexpected read');}}});
 await assert.rejects(resolver.resolveTask({brief:{task_sha256:sha}},{signal:controller.signal}),/^Error: PRODUCTION_STOPPED$/);
 assert.equal(reads,0);
});

test('cancellation during descriptor lookup prevents restoring input artifacts',async()=>{
 const controller=new AbortController();let reads=0;
 const resolver=createStoredTaskResolvers({}, {store:{get:async()=>{
  reads++;controller.abort();return {media_type:'application/json',body:Buffer.from(JSON.stringify(task))};
 }}});
 await assert.rejects(resolver.resolveTask({brief:{task_sha256:sha}},{signal:controller.signal}).then(async t=>{await t.cleanup();return t;}),/PRODUCTION_STOPPED/);
 assert.equal(reads,1);
});

test('cancellation during input restoration stops later reads and removes partial workspace',async()=>{
 const controller=new AbortController(),originalTmpdir=os.tmpdir;
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'pod-cancel-test-'));
 const descriptor={...task,files:{...task.files,'second.json':hashes.image,'third.json':hashes.image}};
 let reads=0;
 os.tmpdir=()=>parent;
 try{
  const resolver=createStoredTaskResolvers({}, {store:{get:async()=>{
   reads++;
   if(reads===1)return {media_type:'application/json',body:Buffer.from(JSON.stringify(descriptor))};
   if(reads===3)controller.abort();
   return artifact(reads===2?hashes.image:hashes.json);
  }}});
  await assert.rejects(resolver.resolveTask({brief:{task_sha256:sha}},{signal:controller.signal}).then(async t=>{await t.cleanup();return t;}),/PRODUCTION_STOPPED/);
  assert.equal(reads,3);assert.deepEqual(await fs.readdir(parent),[]);
 }finally{os.tmpdir=originalTmpdir;await fs.rm(parent,{recursive:true,force:true});}
});

test('production stops after a delayed claim or grant before beginning task restoration',async()=>{
 for(const stopAt of ['claim','grant','restore']){
  const controller=new AbortController(),key='synthetic-cancel-key-'.repeat(3);
  const brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH',task_sha256:sha};
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
   job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,task_sha256:sha});
  let grants=0,tasks=0,reason,restorationSignal;
  const result=await produceOnce({upstreamKey:key,signal:controller.signal,env:{POD_PRODUCTION_ENABLED:'true'},
   db:{claimProduction:async()=>{if(stopAt==='claim')controller.abort();return {id:'j',brief};},failProduction:async(_job,r)=>{reason=r;}},
   resolveGrant:async()=>{grants++;if(stopAt==='grant')controller.abort();return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};},
   resolveTask:async(_job,{signal}={})=>{tasks++;restorationSignal=signal;controller.abort();throw Error('PRODUCTION_STOPPED');}});
  assert.deepEqual(result,{status:'BLOCKED',job_id:'j',reason_code:'PRODUCTION_STOPPED'});
  assert.equal(reason,'PRODUCTION_STOPPED');assert.equal(tasks,stopAt==='restore'?1:0);assert.equal(grants,stopAt==='claim'?0:1);
  if(stopAt==='restore')assert.equal(restorationSignal,controller.signal);
 }
});

test('cancellation after the final file write cannot return a live workspace',async()=>{
 const controller=new AbortController(),originalWrite=fs.writeFile;let written;
 const resolver=createStoredTaskResolvers({}, {store:{get:async id=>id===hashes.descriptor
  ?{media_type:'application/json',body:Buffer.from(JSON.stringify(task))}
  :artifact(id)}});
 fs.writeFile=async(...args)=>{await originalWrite(...args);written=args[0];controller.abort();};
 try{
  await assert.rejects(resolver.resolveTask({brief:{task_sha256:'b'.repeat(64)}},{signal:controller.signal}).then(async t=>{await t.cleanup();return t;}),/PRODUCTION_STOPPED/);
  assert.ok(written);await assert.rejects(fs.stat(path.dirname(written)),{code:'ENOENT'});
 }finally{fs.writeFile=originalWrite;}
});
test('restoration and returned paths stay bound to the opened workspace during a path swap',async()=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'pod-workspace-swap-')),originalTmpdir=os.tmpdir;
 const originalWrite=fs.writeFile;let moved,replacement,swapped=false,resolved;
 os.tmpdir=()=>parent;
 const store={get:async id=>id===hashes.descriptor
  ?{media_type:'application/json',body:Buffer.from(JSON.stringify(task))}
  :artifact(id,'descriptor-bound fixture')};
 fs.writeFile=async(target,...args)=>{
  if(!swapped){
   swapped=true;
   const [name]=await fs.readdir(parent),root=path.join(parent,name);
   moved=root+'-opened';replacement=root;
   await fs.rename(root,moved);await fs.mkdir(replacement,{mode:0o700});
  }
  return originalWrite(target,...args);
 };
 try{
  resolved=await createStoredTaskResolvers({}, {store}).resolveTask({brief:{task_sha256:hashes.descriptor}});
  assert.match(resolved.assetRoot,/^\/proc\/self\/fd\/\d+$/);
  assert.deepEqual(resolved.stageWorkspace,{fd:Number(resolved.assetRoot.split('/').at(-1)),root:resolved.assetRoot});
  assert.equal(await fs.readFile(resolved.source,'utf8'),'descriptor-bound fixture');
  assert.deepEqual(await fs.readdir(replacement),[],'replacement path must receive no restored bytes');
  assert.equal(await fs.readFile(path.join(moved,'source.png'),'utf8'),'descriptor-bound fixture');
 }finally{
  fs.writeFile=originalWrite;os.tmpdir=originalTmpdir;
  try{await resolved?.cleanup();}catch{}
  await fs.rm(parent,{recursive:true,force:true});
 }
});
test('cleanup never recursively removes a nonempty replacement workspace',async()=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'pod-cleanup-race-')),originalTmpdir=os.tmpdir;
 const resolver=createStoredTaskResolvers({}, {store:{get:async id=>id===hashes.descriptor
  ?{media_type:'application/json',body:Buffer.from(JSON.stringify(task))}
  :artifact(id)}});
 os.tmpdir=()=>parent;
 let resolved,raced=false,replacementPath;
 const originalRm=fs.rm,originalRmdir=fs.rmdir;
 const replace=async target=>{
  if(raced||!String(target).startsWith(parent+path.sep))return;
  raced=true;
  replacementPath=target;
  await fs.rename(target,`${target}-moved`);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target,'replacement-marker'),'preserve me');
 };
 fs.rm=async(target,options)=>{if(options?.recursive)await replace(target);return originalRm(target,options);};
 fs.rmdir=async(target,options)=>{await replace(target);return originalRmdir(target,options);};
 try{
  resolved=await resolver.resolveTask({brief:{task_sha256:hashes.descriptor}});
  await resolved.cleanup();
  assert.equal(raced,true,'the regression must replace the workspace at its final removal boundary');
  assert.equal(await fs.readFile(path.join(replacementPath,'replacement-marker'),'utf8'),'preserve me');
 }finally{
  fs.rm=originalRm;fs.rmdir=originalRmdir;os.tmpdir=originalTmpdir;
  await originalRm(parent,{recursive:true,force:true});
 }
});
test('cleanup clears nested generated output without following symlinks',async()=>{
 const outside=await fs.mkdtemp(path.join(os.tmpdir(),'pod-cleanup-outside-'));
 const marker=path.join(outside,'marker');await fs.writeFile(marker,'outside');
 const resolver=createStoredTaskResolvers({}, {store:{get:async id=>id===hashes.descriptor
  ?{media_type:'application/json',body:Buffer.from(JSON.stringify(task))}
  :artifact(id)}});
 const resolved=await resolver.resolveTask({brief:{task_sha256:hashes.descriptor}});
 try{
  await fs.mkdir(path.join(resolved.output,'nested'),{recursive:true});
  await fs.writeFile(path.join(resolved.output,'nested','generated.png'),'generated');
  await fs.symlink(outside,path.join(resolved.output,'outside-link'));
  await resolved.cleanup();
  await assert.rejects(fs.stat(resolved.assetRoot),{code:'ENOENT'});
  assert.equal(await fs.readFile(marker,'utf8'),'outside');
 }finally{
  await resolved.cleanup();
  await fs.rm(outside,{recursive:true,force:true});
 }
});
test('task descriptor blocks traversal and absent roles',()=>{
 assert.throws(()=>validateTask({...task,files:{'../escape':sha}}),/TASK_FILES_INVALID/);
 assert.throws(()=>validateTask({...task,source:'absent'}),/TASK_ROLE_INVALID/);
 for(const templateScope of [undefined,{}, {product:'',country:'US'}, {product:'shirt',country:'us'},
  {product:'shirt\0unsafe',country:'US'},{product:'shirt-\ud800',country:'US'}]){
  assert.throws(()=>validateTask({...task,templateScope}),/TASK_TEMPLATE_SCOPE_REQUIRED/);
 }
});
test('retained template source can only reference a declared input file',async()=>{
 for(const templateSource of [null,false,[],['input.json'],'../input.json','absent',42]){
  assert.throws(()=>validateTask({...task,templateSource}),/TASK_ROLE_INVALID/);
 }
 const descriptor={...task,templateSource:'guide.zip',files:{...task.files,'guide.zip':hashes.zip}};
 const store={get:async id=>id===hashes.descriptor
  ?{body:Buffer.from(JSON.stringify(descriptor)),media_type:'application/json'}
  :artifact(id,'retained source fixture')};
 const resolved=await createStoredTaskResolvers({}, {store}).resolveTask({brief:{task_sha256:hashes.descriptor}});
 try{
  assert.equal(resolved.templateSource,path.join(resolved.assetRoot,'guide.zip'));
  assert.equal(await fs.readFile(resolved.templateSource,'utf8'),'retained source fixture');
 }finally{await resolved.cleanup();}
 await assert.rejects(fs.stat(resolved.assetRoot),{code:'ENOENT'});
});

test('role media types are bound before bytes enter the workspace',async()=>{
 const descriptor={...task,templateSource:'guide.zip',files:{...task.files,'guide.zip':hashes.zip}};
 for(const [target,actual] of [['source.png','application/json'],['input.json','image/png'],['guide.zip','text/plain']]){
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'pod-media-test-')),originalTmpdir=os.tmpdir;os.tmpdir=()=>parent;
  const store={get:async id=>id===hashes.descriptor
   ?{body:Buffer.from(JSON.stringify(descriptor)),media_type:'application/json'}
   :{...artifact(id),media_type:id===descriptor.files[target]?actual:mediaType(id)}};
  try{
   await assert.rejects(createStoredTaskResolvers({}, {store}).resolveTask({brief:{task_sha256:hashes.descriptor}}),/TASK_MEDIA_TYPE_INVALID/);
   assert.deepEqual(await fs.readdir(parent),[],'mismatched media must clean the partial workspace');
  }finally{os.tmpdir=originalTmpdir;await fs.rm(parent,{recursive:true,force:true});}
 }
});

test('one filename cannot alias roles with incompatible media contracts',()=>{
 assert.throws(()=>validateTask({...task,source:'input.json'}),/TASK_MEDIA_TYPE_INVALID/);
 const interior={template:'input.json',pages:'input.json',font:'input.json',fontRights:'input.json',
  fontLicense:'input.json',source:'input.json',bookDetails:'input.json',regionalRightsEvidence:'input.json'};
 assert.throws(()=>validateTask({...task,interior}),/TASK_MEDIA_TYPE_INVALID/);
});
test('generated output names are reserved before any input artifact is fetched',async()=>{
 for(const name of ['package','qa.json','qa-signed.json','PACKAGE','QA.JSON','QA-SIGNED.JSON']){
  const descriptor={...task,files:{...task.files,[name]:sha}};
  let reads=0;const store={get:async()=>{reads++;return {media_type:'application/json',body:Buffer.from(JSON.stringify(descriptor))};}};
  await assert.rejects(createStoredTaskResolvers({}, {store}).resolveTask({brief:{task_sha256:'b'.repeat(64)}}).then(async resolved=>{await resolved.cleanup();return resolved;}),/TASK_FILES_INVALID/);
  assert.equal(reads,1,'invalid descriptors must not restore input artifacts');
 }
});
test('interior accepts exactly eight declared file roles and rejects unchecked paths',()=>{
 const valid={template:'input.json',pages:'input.json',font:'font.ttf',fontRights:'input.json',
  fontLicense:'evidence.txt',source:'guide.zip',bookDetails:'input.json',regionalRightsEvidence:'evidence.txt'};
 const scoped={...task,files:{...task.files,'font.ttf':hashes.font,'evidence.txt':hashes.text,'guide.zip':hashes.zip}};
 for(const interior of [null,false,'input.json',[],{}, {...valid,font:'../font.ttf'},
  {...valid,extra:'../../outside'},{...valid,output:'package'},{...valid,extra:null}]){
  assert.throws(()=>validateTask({...scoped,interior}),/TASK_INTERIOR_INVALID/);
 }
 assert.equal(validateTask({...scoped,interior:valid}).interior,valid);
});
test('artifact identities must be strings rather than values coerced into hashes',async()=>{
 for(const value of [[sha],{toString:()=>sha},null,42]){
  assert.throws(()=>validateTask({...task,files:{'input.json':value}}),/TASK_FILES_INVALID/);
 }
 const resolver=createStoredTaskResolvers({}, {store:{get:async()=>{throw Error('must not fetch');}}});
 await assert.rejects(resolver.resolveTask({brief:{task_sha256:[sha]}}),/TASK_REQUIRED/);
});
test('valid interior restores only declared inputs while output destinations remain absent',async()=>{
 const descriptor={...task,interior:{template:'interior.json',pages:'pages.json',font:'font.ttf',
   fontRights:'font-rights.json',fontLicense:'font-license.txt',source:'interior-source.zip',
   bookDetails:'book-details.json',regionalRightsEvidence:'regional-rights-evidence.txt'},
  files:{...task.files,'interior.json':hashes.json,'pages.json':hashes.json,'font.ttf':hashes.font,
   'font-rights.json':hashes.json,'font-license.txt':hashes.text,'interior-source.zip':hashes.zip,
   'book-details.json':hashes.json,'regional-rights-evidence.txt':hashes.text}};
 const store={get:async id=>id===hashes.descriptor?{body:Buffer.from(JSON.stringify(descriptor)),media_type:'application/json'}:artifact(id)};
 const resolved=await createStoredTaskResolvers({}, {store}).resolveTask({brief:{task_sha256:hashes.descriptor}});
 try{
  assert.deepEqual(Object.keys(resolved.interior),['template','pages','font','fontRights','fontLicense','source','bookDetails','regionalRightsEvidence']);
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
 const store={get:async id=>id===hashes.descriptor?{body:descriptor,media_type:'application/json'}:artifact(id,'payload')};
 const resolver=createStoredTaskResolvers({}, {store});
 const resolved=await resolver.resolveTask({brief:{task_sha256:hashes.descriptor}});
 assert.equal(await fs.readFile(resolved.source,'utf8'),'payload');
 assert.equal(resolved.reviewPackage,undefined);
 assert.deepEqual(resolved.approvedEditorialEvaluators,[]);
 assert.deepEqual(resolved.templateScope,task.templateScope);
 await resolved.cleanup();await assert.rejects(fs.stat(resolved.assetRoot),{code:'ENOENT'});
 const authorized=createStoredTaskResolvers({}, {store,approvedEditorialEvaluators:['host-fixture']});
 const approved=await authorized.resolveTask({brief:{task_sha256:hashes.descriptor}});
 try{assert.deepEqual(approved.approvedEditorialEvaluators,['host-fixture']);}finally{await approved.cleanup();}
});

