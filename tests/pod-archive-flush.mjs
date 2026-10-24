import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Exercise each public exporter against real files, with faults only at the
// final directory flush boundary. Tests do not simulate an actual power loss.
export async function verifyExportFlush(t,directory,run,{fault}={}){
 const parent=path.dirname(directory),name=path.basename(directory),open=fs.open.bind(fs),events=[];
 const failure=Object.assign(Error('fixture flush failure'),{code:'EIO'});
 const mock=t.mock.method(fs,'open',async(file,...args)=>{
  const kind=file===parent?'parent':typeof file==='string'&&file.startsWith('/proc/self/fd/')&&path.basename(file)===name?'archive':null;
  if(!kind)return open(file,...args);
  events.push(kind+':open');
  if(fault===kind+':open')throw failure;
  const handle=await open(file,...args);
  return {
   fd:handle.fd,stat:handle.stat.bind(handle),
   async sync(){events.push(kind+':sync');if(fault===kind+':sync')throw failure;await handle.sync();},
   async close(){events.push(kind+':close');await handle.close();}
  };
 });
 try{
  if(fault){await assert.rejects(run(),error=>error===failure);}
  else {const result=await run();assert.equal(result.status,'EXPORTED');}
  const successful=['parent:open','archive:open','archive:sync','parent:sync','archive:close','parent:close'];
  const expected=fault==='archive:sync'?[...successful.slice(0,3),'archive:close','parent:close']:
   fault==='parent:open'?['parent:open']:successful;
  assert.deepEqual(events,expected);
  // Even a rejected final flush can leave readable encrypted bytes. Their
  // presence must not turn the rejected export into a successful receipt.
  if(fault==='parent:open')await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),{code:'ENOENT'});
  else assert.ok((await fs.stat(path.join(directory,'catalog.pod'))).isFile());
 }finally{mock.mock.restore();}
}
