import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Exercise each public exporter against real files, with faults only at the
// final directory flush boundary. Tests do not simulate an actual power loss.
export async function verifyExportFlush(t,directory,run,{fault}={}){
 const parent=path.dirname(directory),open=fs.open.bind(fs),events=[];
 const failure=Object.assign(Error('fixture flush failure'),{code:'EIO'});
 const mock=t.mock.method(fs,'open',async(file,...args)=>{
  if(file!==directory&&file!==parent)return open(file,...args);
  const name=file===directory?'archive':'parent';events.push(name+':open');
  if(fault===name+':open')throw failure;
  const handle=await open(file,...args);
  return {
   async sync(){events.push(name+':sync');if(fault===name+':sync')throw failure;await handle.sync();},
   async close(){events.push(name+':close');await handle.close();}
  };
 });
 try{
  if(fault){await assert.rejects(run(),error=>error===failure);}
  else {const result=await run();assert.equal(result.status,'EXPORTED');}
  const successful=['archive:open','archive:sync','archive:close','parent:open','parent:sync','parent:close'];
  const expected=fault==='archive:sync'?successful.slice(0,3):fault==='parent:open'?successful.slice(0,4):successful;
  assert.deepEqual(events,expected);
  // Even a rejected final flush can leave readable encrypted bytes. Their
  // presence must not turn the rejected export into a successful receipt.
  assert.ok((await fs.stat(path.join(directory,'catalog.pod'))).isFile());
 }finally{mock.mock.restore();}
}
