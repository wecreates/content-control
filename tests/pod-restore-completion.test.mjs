import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {exportArtifactLibrary,restoreArtifactLibrary} from '../integrations/pod/artifact-archive.mjs';
import {exportStateArchive,restoreStateArchive} from '../integrations/pod/state-archive.mjs';

const key=Buffer.alloc(32,17);
const flags={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',POD_PRODUCTION_ENABLED:'false',POD_OUTBOX_ENABLED:'false'};
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
// Empty, encrypted archives keep this fixture focused on the transaction's
// completion boundary. Separate PostgreSQL tests verify persisted restored data.
async function emptySource(){
 const versions=await Promise.all(['001','002','003','004','005'].map(async n=>({
  version:n+'_pod.sql',sha256:digest(await fs.readFile(new URL('../migrations/'+n+'_pod.sql',import.meta.url)))
 })));
 const queries=[];
 const client={release(){},async query(sql){
  queries.push(sql);
  if(sql.includes('FROM public.pod_schema_version'))return {rows:versions};
  if(sql.includes('FROM pg_attribute'))return {rows:[{name:'id',type:'uuid',required:true}]};
  if(sql.includes('COALESCE(sum'))return {rows:[{bytes:'0'}]};
  return {rows:[],rowCount:0};
 }};
 return {queries,client,pool:{connect:async()=>client}};
}
for(const kind of ['artifact','state']){
 const required=kind==='artifact'?['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED']:Object.keys(flags);
 for(const change of ['abort',...required]){
  test(`${kind} restore rejects ${change} during transaction completion`,async t=>{
   const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-restore-completion-'));
   t.after(()=>fs.rm(root,{recursive:true,force:true}));
   const directory=path.join(root,'snapshot'),env={...flags},source=await emptySource();
   const controller=new AbortController(),reason=Error('RESTORE_CANCELLED_FIXTURE');
   const exportArchive=kind==='artifact'?exportArtifactLibrary:exportStateArchive;
   const restore=kind==='artifact'?restoreArtifactLibrary:restoreStateArchive;
   await exportArchive(source,{directory,key,env});
   let committed=false,callbackResult;
   const db={tx:async fn=>{
    callbackResult=await fn(source.client);
    // Model successful COMMIT/connection release after the callback's final
    // safety check. A later rejection must not claim this was rolled back.
    committed=true;
    if(change==='abort')controller.abort(reason);else env[change]='true';
    return callbackResult;
   }};
   await assert.rejects(restore(db,{directory,key,env,signal:controller.signal}),
    change==='abort'?error=>error===reason:kind==='artifact'?/ARCHIVE_PUBLICATION_MUST_BE_DISABLED/:/STATE_ARCHIVE_WORKERS_MUST_BE_DISABLED/);
   assert.equal(committed,true);assert.equal(callbackResult.status,'RESTORED');
  });
 }
}
