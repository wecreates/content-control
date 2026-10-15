import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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
