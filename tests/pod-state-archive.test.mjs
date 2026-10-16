import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {exportStateArchive,verifyStateArchive,restoreStateArchive} from '../integrations/pod/state-archive.mjs';
import {seal,unseal} from '../integrations/pod/archive-codec.mjs';
import {stateArchiveCLI} from '../scripts/pod_state_archive.mjs';

const key=Buffer.alloc(32,31),env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',POD_PRODUCTION_ENABLED:'false',POD_OUTBOX_ENABLED:'false'};
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-state-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const directory=path.join(root,'snapshot'),queries=[];
 const versions=await Promise.all(['001','002','003','004','005'].map(async n=>({version:n+'_pod.sql',sha256:digest(await fs.readFile(new URL('../migrations/'+n+'_pod.sql',import.meta.url)))})));
 const data={pod_artifacts:[JSON.stringify({sha256:digest('fixture'),body:'\\x'+Buffer.from('fixture').toString('hex'),media_type:'application/json'})],
  pod_financial_events:['{"id":"fixture","amount_minor":9007199254740993}']};
 let table,cursor=0;
 const client={release(){},query:async(sql,args)=>{
  queries.push(sql);
  if(sql.includes('FROM public.pod_schema_version'))return {rows:versions};
  if(sql.includes('FROM pg_attribute')){
   const name=args[0].slice(7),names=name==='pod_artifacts'?['sha256','body','media_type']:name==='pod_financial_events'?['id','amount_minor']:['id'];
   return {rows:names.map(name=>({name,type:'text',required:true}))};
  }
  if(sql.startsWith('DECLARE')){table=/FROM public\.(\w+) t/.exec(sql)[1];cursor=0;}
  if(sql.startsWith('FETCH')){const rows=data[table]||[];return {rows:cursor<rows.length?[{record:rows[cursor++]}]:[]};}
  return {rows:[]};
 }};
 return {root,directory,queries,data,versions,db:{pool:{connect:async()=>client}}};
}
test('state archive is offline verifiable, encrypted and scoped to the ten POD tables',async t=>{
 const f=await fixture(t),receipt=await exportStateArchive(f.db,{...f,key,env});
 const verified=await verifyStateArchive({...f,key});
 assert.equal(verified.records,2);assert.equal(verified.artifact_bytes,7);assert.equal(verified.archive_sha256,receipt.archive_sha256);
 assert.ok(f.queries.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
 assert.ok(f.queries.every(q=>!q.includes('social_vault')));
 const catalogBytes=await fs.readFile(path.join(f.directory,'catalog.pod'));
 assert.equal(catalogBytes.includes(Buffer.from('pod_financial_events')),false);
 const catalog=JSON.parse(unseal(catalogBytes,key,'pod:state-catalog:v1'));
 assert.equal(catalog.tables.length,10);
 const item=catalog.items[1],raw=unseal(await fs.readFile(path.join(f.directory,'00001.pod')),key,
  `pod:state:v1:${catalog.snapshot_id}:${item.table}:${item.index}:${item.sha256}:${item.bytes}`);
 assert.match(raw.toString(),/9007199254740993/);
 if(process.platform!=='win32')assert.equal((await fs.stat(path.join(f.directory,'catalog.pod'))).mode&0o777,0o600);
});
test('wrong key, tampered row, missing row, and aborted verification fail closed',async t=>{
 const f=await fixture(t);await exportStateArchive(f.db,{...f,key,env});
 await assert.rejects(verifyStateArchive({...f,key:Buffer.alloc(32,8)}),/ARCHIVE_AUTH_FAILED/);
 await assert.rejects(verifyStateArchive({...f,key,signal:AbortSignal.abort()}));
 const p=path.join(f.directory,'00001.pod'),original=await fs.readFile(p),corrupt=Buffer.from(original);corrupt[40]^=1;await fs.writeFile(p,corrupt);
 let connected=false;const db={tx(){connected=true;throw Error('UNEXPECTED_DATABASE_ACCESS');}};
 await assert.rejects(restoreStateArchive(db,{...f,key,env}),/ARCHIVE_AUTH_FAILED/);assert.equal(connected,false);
 await fs.rm(p);await assert.rejects(verifyStateArchive({...f,key}));
});
test('record substitution across independently encrypted snapshots is rejected',async t=>{
 const f=await fixture(t),second=path.join(f.root,'second');await exportStateArchive(f.db,{...f,key,env});
 await exportStateArchive(f.db,{directory:second,key,env});
 await fs.copyFile(path.join(second,'00001.pod'),path.join(f.directory,'00001.pod'));
 await assert.rejects(verifyStateArchive({...f,key}),/ARCHIVE_AUTH_FAILED/);
});
test('catalog cannot introduce tables, duplicate indexes or mismatching migrations',async t=>{
 const f=await fixture(t);await exportStateArchive(f.db,{...f,key,env});
 const p=path.join(f.directory,'catalog.pod'),original=JSON.parse(unseal(await fs.readFile(p),key,'pod:state-catalog:v1'));
 for(const change of [c=>{c.tables.push('foreign_table');},c=>{c.items[1].index=0;},c=>{c.versions[0].sha256='0'.repeat(64);}]){
  const c=structuredClone(original);change(c);await fs.writeFile(p,seal(Buffer.from(JSON.stringify(c)),key,'pod:state-catalog:v1'));
  await assert.rejects(verifyStateArchive({...f,key}),/STATE_ARCHIVE_CATALOG_INVALID/);
 }
});
test('invalid source or exhausted artifact budget cannot create a complete catalog',async t=>{
 for(const failure of ['checksum','oversized','artifact']){
  const f=await fixture(t);
  if(failure==='checksum')f.versions[0].sha256='0'.repeat(64);
  if(failure==='oversized')f.data.pod_financial_events=[null];
  if(failure==='artifact')f.data.pod_artifacts[0]=f.data.pod_artifacts[0].replace('66697874757265','00697874757265');
  await assert.rejects(exportStateArchive(f.db,{...f,key,env}));
  await assert.rejects(fs.stat(path.join(f.directory,'catalog.pod')),{code:'ENOENT'});
  assert.equal(f.queries.at(-1),'ROLLBACK');
 }
 const f=await fixture(t);await assert.rejects(exportStateArchive(f.db,{...f,key,env:{...env,POD_ARTIFACT_BUDGET_BYTES:'1'}}),/STATE_ARCHIVE_BUDGET_EXCEEDED/);
});
test('restore and CLI require disabled workers and explicit empty-target recovery confirmation',async()=>{
 let called=false;const db={tx(){called=true;}};
 for(const flag of Object.keys(env))await assert.rejects(restoreStateArchive(db,{directory:'/unused',key,env:{...env,[flag]:'true'}}),/WORKERS_MUST_BE_DISABLED/);
 assert.equal(called,false);
 await assert.rejects(stateArchiveCLI(['restore','/unused'],{...env,POD_ARCHIVE_KEY:key.toString('hex')}),/STATE_ARCHIVE_RESTORE_NOT_AUTHORIZED/);
 await assert.rejects(stateArchiveCLI(['export','/unused'],{...env,POD_ARCHIVE_KEY:'invalid'}),/STATE_ARCHIVE_CLI_CONFIG_INVALID/);
});
