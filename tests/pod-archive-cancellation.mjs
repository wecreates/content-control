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
 const open=fs.open.bind(fs),target=phase==='catalog'?path.join(directory,'catalog.pod'):path.dirname(directory);
 const mock=t.mock.method(fs,'open',async(file,...args)=>{
  const handle=await open(file,...args);
  if(phase==='commit'||file!==target||(phase==='catalog'&&args[0]!=='wx'))return handle;
  return {writeFile:handle.writeFile.bind(handle),
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
