import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Real files and fsync, with cancellation injected only after the selected
// asynchronous boundary. This does not simulate physical power loss.
export async function verifyExportCancellation(t,{db,directory,run,verify,phase}){
 const controller=new AbortController(),reason=Error('ARCHIVE_CANCELLED_FIXTURE');
 const client=await db.pool.connect(),query=client.query.bind(client),releases=[];
 t.mock.method(db.pool,'connect',async()=>client);
 t.mock.method(client,'release',discard=>releases.push(discard));
 t.mock.method(client,'query',async(...args)=>{
  const result=await query(...args);
  if(phase==='commit'&&args[0]==='COMMIT')controller.abort(reason);
  return result;
 });
 const open=fs.open.bind(fs),target=phase==='catalog'?'catalog.pod':path.dirname(directory);
 const mock=t.mock.method(fs,'open',async(file,...args)=>{
  const handle=await open(file,...args);
  const matched=phase==='catalog'?path.basename(file)===target&&args[0]==='wx':file===target;
  if(phase==='commit'||!matched)return handle;
  return {fd:handle.fd,stat:handle.stat.bind(handle),writeFile:handle.writeFile.bind(handle),
   async sync(){await handle.sync();controller.abort(reason);},
   close:handle.close.bind(handle)};
 });
 try{
  await assert.rejects(run(controller.signal),error=>error===reason);
  assert.equal(controller.signal.aborted,true);assert.deepEqual(releases,[false]);
  if(phase==='commit')await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),{code:'ENOENT'});
  else {
   // Cancellation cannot erase completed file writes. Independently verified
   // bytes may remain, but must never turn the rejected operation into EXPORTED.
   assert.equal((await verify()).status,'VERIFIED');
  }
 }finally{mock.mock.restore();}
}

export async function verifyExportRelease(t,{db,directory,run,phase}){
 const controller=new AbortController(),reason=Error('ARCHIVE_CANCELLED_FIXTURE');
 const failure=Error('ARCHIVE_QUERY_FAILURE_FIXTURE'),releaseError=Error('ARCHIVE_RELEASE_FAILURE_FIXTURE');
 const client=await db.pool.connect(),calls=[];
 let started,settle,finished=false;
 const entered=new Promise(resolve=>{started=resolve;});
 t.mock.method(db.pool,'connect',async()=>client);
 if(phase==='rollback'){
  const query=client.query.bind(client);
  t.mock.method(client,'query',(...args)=>args[0].startsWith('FETCH')?Promise.reject(failure):query(...args));
 }
 t.mock.method(client,'release',discard=>{
  calls.push(discard);started();
  if(phase==='rollback')throw releaseError;
  return new Promise((resolve,reject)=>{settle={resolve,reject};});
 });
 const pending=run(controller.signal);
 const outcome=pending.then(value=>{finished=true;return value;},error=>{finished=true;return error;});
 await entered;
 if(phase==='rollback')assert.equal(await outcome,failure);
 else if(phase==='rejection'){
  settle.reject(releaseError);
  assert.equal(await outcome,releaseError);
 }else if(phase==='abort'){
  controller.abort(reason);
  assert.equal(await outcome,reason);
  settle.reject(releaseError);
 }else{
  try{
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(finished,false);
   await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),{code:'ENOENT'});
  }finally{settle.resolve();}
  assert.equal((await outcome).status,'EXPORTED');
 }
 assert.deepEqual(calls,[false]);
 if(phase!=='success')await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),{code:'ENOENT'});
}
