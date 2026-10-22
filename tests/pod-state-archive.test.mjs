import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {exportStateArchive,verifyStateArchive,restoreStateArchive} from '../integrations/pod/state-archive.mjs';
import {ARTIFACT_MEDIA_TYPES} from '../integrations/pod/artifacts.mjs';
import {seal,unseal} from '../integrations/pod/archive-codec.mjs';
import {stateArchiveCLI} from '../scripts/pod_state_archive.mjs';
import {verifyExportFlush} from './pod-archive-flush.mjs';
import {verifyExportCancellation} from './pod-archive-cancellation.mjs';

const key=Buffer.alloc(32,31),env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',POD_PRODUCTION_ENABLED:'false',POD_OUTBOX_ENABLED:'false'};
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
const artifactRecord=(body,mediaType)=>JSON.stringify({sha256:digest(body),body:'\\x'+Buffer.from(body).toString('hex'),media_type:mediaType});
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-state-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const directory=path.join(root,'snapshot'),queries=[];
 const versions=await Promise.all(['001','002','003','004','005'].map(async n=>({version:n+'_pod.sql',sha256:digest(await fs.readFile(new URL('../migrations/'+n+'_pod.sql',import.meta.url)))})));
 const data={pod_artifacts:[artifactRecord('fixture','application/json')],
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
for(const phase of ['commit','catalog','parent'])test('state export rejects cancellation during '+phase,async t=>{
 const f=await fixture(t);
 await verifyExportCancellation(t,{...f,phase,
  run:signal=>exportStateArchive(f.db,{...f,key,env,signal}),
  verify:()=>verifyStateArchive({...f,key})});
});
for(const phase of ['commit','catalog','archive','parent'])for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED']){
 test(`state export rejects ${flag} changing during ${phase} completion`,async t=>{
  const f=await fixture(t),settings={...env},client=await f.db.pool.connect(),releases=[];
  t.mock.method(client,'release',discard=>releases.push(discard));
  const query=client.query.bind(client);
  t.mock.method(client,'query',async(...args)=>{
   const result=await query(...args);
   if(phase==='commit'&&args[0]==='COMMIT')settings[flag]='true';
   return result;
  });
  const open=fs.open.bind(fs),target=phase==='catalog'?path.join(f.directory,'catalog.pod'):
   phase==='archive'?f.directory:path.dirname(f.directory);
  const mock=t.mock.method(fs,'open',async(file,...args)=>{
   const handle=await open(file,...args);
   if(phase==='commit'||file!==target||(phase==='catalog'&&args[0]!=='wx'))return handle;
   return {writeFile:handle.writeFile.bind(handle),
    async sync(){await handle.sync();settings[flag]='true';},close:handle.close.bind(handle)};
  });
  try{
   await assert.rejects(exportStateArchive(f.db,{directory:f.directory,key,env:settings}),/^Error: STATE_ARCHIVE_WORKERS_MUST_BE_DISABLED$/);
   assert.deepEqual(releases,[false]);assert.equal(f.queries.includes('COMMIT'),true);
   assert.equal(f.queries.some(sql=>/^(INSERT|UPDATE|DELETE|TRUNCATE)/.test(sql)),false);
   if(phase==='commit')await assert.rejects(fs.stat(path.join(f.directory,'catalog.pod')),{code:'ENOENT'});
   else assert.equal((await verifyStateArchive({directory:f.directory,key})).status,'VERIFIED');
  }finally{mock.mock.restore();}
 });
}
for(const fault of [undefined,'archive:sync','parent:open','parent:sync'])test('state export requires complete directory flush: '+(fault||'success'),async t=>{
 const f=await fixture(t);
 await verifyExportFlush(t,f.directory,()=>exportStateArchive(f.db,{...f,key,env}),{fault});
});
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
test('state recovery preserves every current artifact media type',async t=>{
 const f=await fixture(t),bodies=ARTIFACT_MEDIA_TYPES.map((mediaType,index)=>`state-${index}-${mediaType}`);
 f.data.pod_artifacts=bodies.map((body,index)=>artifactRecord(body,ARTIFACT_MEDIA_TYPES[index]));
 const exported=await exportStateArchive(f.db,{...f,key,env});
 const verified=await verifyStateArchive({...f,key});
 assert.equal(exported.records,ARTIFACT_MEDIA_TYPES.length+1);
 assert.equal(verified.records,ARTIFACT_MEDIA_TYPES.length+1);
 assert.equal(verified.artifact_bytes,bodies.reduce((total,body)=>total+Buffer.byteLength(body),0));
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
test('state catalog rejects escaped duplicate decoded keys',async t=>{
 const f=await fixture(t);await exportStateArchive(f.db,{...f,key,env});
 const file=path.join(f.directory,'catalog.pod');
 const body=unseal(await fs.readFile(file),key,'pod:state-catalog:v1').toString('utf8');
 const ambiguous=body.replace('"scope":"pod_tables_only"','"scope":"foreign","sc\\u006fpe":"pod_tables_only"');
 assert.notEqual(ambiguous,body);
 await fs.writeFile(file,seal(Buffer.from(ambiguous),key,'pod:state-catalog:v1'));
 await assert.rejects(verifyStateArchive({...f,key}),/STATE_ARCHIVE_CATALOG_INVALID/);
});
test('state records reject escaped duplicate decoded keys',async t=>{
 const f=await fixture(t);await exportStateArchive(f.db,{...f,key,env});
 const catalogFile=path.join(f.directory,'catalog.pod');
 const catalog=JSON.parse(unseal(await fs.readFile(catalogFile),key,'pod:state-catalog:v1'));
 const item=catalog.items.find(candidate=>candidate.table==='pod_financial_events');
 const aad=current=>`pod:state:v1:${catalog.snapshot_id}:${current.table}:${current.index}:${current.sha256}:${current.bytes}`;
 const recordFile=path.join(f.directory,String(item.index).padStart(5,'0')+'.pod');
 const body=unseal(await fs.readFile(recordFile),key,aad(item)).toString('utf8');
 const ambiguous=Buffer.from(body.replace('"amount_minor":','"amount_minor":"invalid","amount\\u005fminor":'));
 assert.notEqual(ambiguous.toString(),body);
 item.bytes=ambiguous.length;item.sha256=digest(ambiguous);
 await fs.writeFile(recordFile,seal(ambiguous,key,aad(item)));
 await fs.writeFile(catalogFile,seal(Buffer.from(JSON.stringify(catalog)),key,'pod:state-catalog:v1'));
 await assert.rejects(verifyStateArchive({...f,key}),/STATE_ARCHIVE_RECORD_INVALID/);
});
test('invalid source or exhausted artifact budget cannot create a complete catalog',async t=>{
 for(const failure of ['checksum','oversized','artifact','media-type']){
  const f=await fixture(t);
  if(failure==='checksum')f.versions[0].sha256='0'.repeat(64);
  if(failure==='oversized')f.data.pod_financial_events=[null];
  if(failure==='artifact')f.data.pod_artifacts[0]=f.data.pod_artifacts[0].replace('66697874757265','00697874757265');
  if(failure==='media-type')f.data.pod_artifacts[0]=f.data.pod_artifacts[0].replace('application/json','text/html');
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

for(const phase of ['BEGIN','FETCH','COMMIT'])for(const brokenRollback of [false,true]){
 test(`state export ${phase} failure with broken rollback=${brokenRollback}`,async t=>{
  const f=await fixture(t),{directory,db}=f;
  const client=await db.pool.connect(),query=client.query.bind(client),calls=[],releases=[];
  const failure=Error('EXPORT_FIXTURE_FAILURE');
  client.query=async(sql,...args)=>{calls.push(sql);
   if(sql.startsWith(phase))throw failure;
   if(sql==='ROLLBACK'&&brokenRollback)throw Error('ROLLBACK_FIXTURE_FAILURE');
   return query(sql,...args);
  };
  client.release=discard=>releases.push(discard);db.pool.connect=async()=>client;
  await assert.rejects(exportStateArchive(db,{directory,key,env}),error=>error===failure);
  assert.deepEqual(releases,[brokenRollback]);assert.equal(calls.at(-1),'ROLLBACK');
  await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),error=>error.code==='ENOENT');
 });
}
test('state successful export returns a clean connection without rollback',async t=>{
 const f=await fixture(t),{directory,db}=f;
 const client=await db.pool.connect(),query=client.query.bind(client),calls=[],releases=[];
 client.query=async(sql,...args)=>{calls.push(sql);return query(sql,...args);};
 client.release=discard=>releases.push(discard);db.pool.connect=async()=>client;
 assert.equal((await exportStateArchive(db,{directory,key,env})).status,'EXPORTED');
 assert.deepEqual(releases,[false]);assert.equal(calls.at(-1),'COMMIT');
 assert.equal(calls.includes('ROLLBACK'),false);
});
