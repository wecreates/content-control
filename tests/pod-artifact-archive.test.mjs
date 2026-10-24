import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {exportArtifactLibrary,restoreArtifactLibrary,verifyArtifactLibrary} from '../integrations/pod/artifact-archive.mjs';
import {ARTIFACT_MEDIA_TYPES} from '../integrations/pod/artifacts.mjs';
import {archiveCLI} from '../scripts/pod_artifact_archive.mjs';
import {seal,unseal} from '../integrations/pod/archive-codec.mjs';
import {verifyExportFlush} from './pod-archive-flush.mjs';
import {verifyExportCancellation} from './pod-archive-cancellation.mjs';
const key=Buffer.alloc(32,7),env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'};
const sha=body=>crypto.createHash('sha256').update(body).digest('hex');
function database(values=[]){
 const rows=new Map(values.map(value=>{
  const body=Buffer.isBuffer(value)?value:value.body;
  return [sha(body),{body,media_type:Buffer.isBuffer(value)?'application/json':value.mediaType}];
 }));let queries=[],index=0;
 const query=async(sql,args=[])=>{
  queries.push(sql);
  if(sql.startsWith('DECLARE')){index=0;return {rows:[]};}
  if(sql.startsWith('FETCH')){const entries=[...rows].sort(([a],[b])=>a.localeCompare(b));const item=entries[index++];return {rows:item?[{sha256:item[0],...item[1]}]:[]};}
  if(sql.includes('COALESCE(sum'))return {rows:[{bytes:String([...rows.values()].reduce((n,x)=>n+x.body.length,0))}]};
  if(sql.startsWith('SELECT media_type,octet_length')){const row=rows.get(args[0]);return {rows:row?[{media_type:row.media_type,
   bytes:row.body.length,body_sha256:row.body.length===args[1]?sha(row.body):null}]:[]};}
  if(sql.startsWith('INSERT INTO public.pod_artifacts')){rows.set(args[0],{body:args[1],media_type:args[2]});return {rows:[]};}
  if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT pg_advisory)/.test(sql))return {rows:[]};
  throw Error('UNEXPECTED_QUERY');
 };
 return {rows,queries,pool:{connect:async()=>({query,release(){}})},tx:async fn=>{
  const snapshot=new Map(rows);try{return await fn({query});}catch(e){rows.clear();for(const [k,v] of snapshot)rows.set(k,v);throw e;}
 }};
}
async function workspace(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-archive-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return path.join(root,'archive');}
for(const phase of ['commit','catalog','parent'])test('artifact export rejects cancellation during '+phase,async t=>{
 const directory=await workspace(t),db=database([Buffer.from('cancellation fixture')]);
 await verifyExportCancellation(t,{db,directory,phase,
  run:signal=>exportArtifactLibrary(db,{directory,key,signal}),
  verify:()=>verifyArtifactLibrary({directory,key})});
});
for(const fault of [undefined,'archive:sync','parent:open','parent:sync'])test('artifact export requires complete directory flush: '+(fault||'success'),async t=>{
 const directory=await workspace(t);
 await verifyExportFlush(t,directory,()=>exportArtifactLibrary(database([Buffer.from('flush fixture')]),{directory,key}),{fault});
});
test('encrypted export and restore preserve exact bytes with idempotent retries',async t=>{
 const directory=await workspace(t),source=database([Buffer.from('private-fixture-one'),Buffer.from('private-fixture-two')]);
 const exported=await exportArtifactLibrary(source,{directory,key});assert.equal(exported.objects,2);
 assert.equal((await fs.stat(directory)).mode&0o777,0o700);
 for(const name of await fs.readdir(directory)){
  const body=await fs.readFile(path.join(directory,name));assert.equal(body.includes(Buffer.from('private-fixture')),false);
  assert.equal((await fs.stat(path.join(directory,name))).mode&0o777,0o600);
 }
 assert.ok(source.queries.every(sql=>!sql.includes('social_vault')&&!sql.startsWith('INSERT')));
 const target=database();assert.equal((await restoreArtifactLibrary(target,{directory,key,env})).inserted,2);
 assert.equal((await restoreArtifactLibrary(target,{directory,key,env})).inserted,0);
 assert.deepEqual(target.rows,source.rows);
});
test('artifact recovery preserves every current upload media type',async t=>{
 const directory=await workspace(t),values=ARTIFACT_MEDIA_TYPES.map((mediaType,index)=>({
  body:Buffer.from(`recoverable-${index}-${mediaType}`),mediaType,
 }));
 const source=database(values),exported=await exportArtifactLibrary(source,{directory,key});
 assert.equal(exported.objects,ARTIFACT_MEDIA_TYPES.length);
 assert.equal((await verifyArtifactLibrary({directory,key})).objects,ARTIFACT_MEDIA_TYPES.length);
 const target=database();
 assert.equal((await restoreArtifactLibrary(target,{directory,key,env})).inserted,ARTIFACT_MEDIA_TYPES.length);
 assert.deepEqual(target.rows,source.rows);
});
test('artifact recovery rejects media types outside the upload contract',async t=>{
 const directory=await workspace(t),source=database([{body:Buffer.from('unsupported'),mediaType:'text/html'}]);
 await assert.rejects(exportArtifactLibrary(source,{directory,key}),/ARCHIVE_ARTIFACT_INVALID/);
 await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),{code:'ENOENT'});
});
test('corrupt late artifact rolls back earlier inserts',async t=>{
 const directory=await workspace(t),source=database([Buffer.from('one'),Buffer.from('two')]);await exportArtifactLibrary(source,{directory,key});
 const hashes=[...source.rows.keys()].sort(),file=path.join(directory,hashes.at(-1)+'.pod');
 const bytes=await fs.readFile(file);bytes[bytes.length-1]^=1;await fs.writeFile(file,bytes);
 const target=database();await assert.rejects(restoreArtifactLibrary(target,{directory,key,env}),/ARCHIVE_AUTH_FAILED/);assert.equal(target.rows.size,0);
});
test('wrong key, truncated catalog and symlinked catalog cannot restore',async t=>{
 const directory=await workspace(t);await exportArtifactLibrary(database([Buffer.from('one')]),{directory,key});
 const target=database();await assert.rejects(restoreArtifactLibrary(target,{directory,key:Buffer.alloc(32,8),env}),/ARCHIVE_AUTH_FAILED/);
 const catalog=path.join(directory,'catalog.pod'),original=await fs.readFile(catalog);
 await fs.writeFile(catalog,original.subarray(0,20));await assert.rejects(restoreArtifactLibrary(target,{directory,key,env}),/ARCHIVE_SIZE_INVALID/);
 await fs.rename(catalog,catalog+'.invalid');await fs.symlink(catalog+'.invalid',catalog);
 await assert.rejects(restoreArtifactLibrary(target,{directory,key,env}));assert.equal(target.rows.size,0);
});
test('artifact catalog rejects escaped duplicate decoded keys',async t=>{
 const directory=await workspace(t);await exportArtifactLibrary(database(),{directory,key});
 const file=path.join(directory,'catalog.pod');
 const body=unseal(await fs.readFile(file),key,'pod:artifact-catalog:v1').toString('utf8');
 const ambiguous=body.replace('"scope":"artifacts_only"','"scope":"foreign","sc\\u006fpe":"artifacts_only"');
 assert.notEqual(ambiguous,body);
 await fs.writeFile(file,seal(Buffer.from(ambiguous),key,'pod:artifact-catalog:v1'));
 await assert.rejects(verifyArtifactLibrary({directory,key}),/ARCHIVE_CATALOG_INVALID/);
});
test('export never overwrites a directory and incomplete export has no catalog',async t=>{
 const directory=await workspace(t),source=database([Buffer.from('one')]);
 await assert.rejects(exportArtifactLibrary(source,{directory,key,budgetBytes:1}),/ARCHIVE_BUDGET_EXCEEDED/);
 await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),e=>e.code==='ENOENT');
 await assert.rejects(exportArtifactLibrary(source,{directory,key}),e=>e.code==='EEXIST');
});
test('artifact export cannot be redirected by replacing its new directory',async t=>{
 const directory=await workspace(t),held=directory+'-held',replacement=directory+'-replacement';
 const source=database([Buffer.from('path identity fixture')]);
 const connect=source.pool.connect.bind(source.pool);
 source.pool.connect=async()=>{
  await fs.rename(directory,held);await fs.mkdir(replacement,{mode:0o700});
  await fs.symlink(replacement,directory,'dir');
  return connect();
 };
 await assert.rejects(exportArtifactLibrary(source,{directory,key}),/ARCHIVE_DIRECTORY_INVALID/);
 await assert.rejects(fs.stat(path.join(replacement,'catalog.pod')),{code:'ENOENT'});
});
test('restore requires both explicit disabled flags and rejects cancellation',async t=>{
 const directory=await workspace(t);await exportArtifactLibrary(database(),{directory,key});
 for(const flags of [{},{...env,PUBLICATION_ENABLED:'true'},{PUBLICATION_ENABLED:'false'}]){
  await assert.rejects(restoreArtifactLibrary(database(),{directory,key,env:flags}),/ARCHIVE_PUBLICATION_MUST_BE_DISABLED/);
 }
 const controller=new AbortController();controller.abort();
 await assert.rejects(restoreArtifactLibrary(database(),{directory,key,env,signal:controller.signal}),e=>e.name==='AbortError');
});
test('target budget and conflicting immutable metadata fail without partial writes',async t=>{
 const directory=await workspace(t),body=Buffer.from('source');await exportArtifactLibrary(database([body]),{directory,key});
 const target=database([Buffer.from('already-full')]);
 await assert.rejects(restoreArtifactLibrary(target,{directory,key,env,budgetBytes:12}),/ARCHIVE_BUDGET_EXCEEDED/);assert.equal(target.rows.size,1);
 const conflict=database([body]);conflict.rows.get(sha(body)).media_type='image/png';
 await assert.rejects(restoreArtifactLibrary(conflict,{directory,key,env}),/ARCHIVE_RESTORE_CONFLICT/);
});
test('restore cannot exceed the deployment budget even with a larger caller limit',async t=>{
 const directory=await workspace(t),body=Buffer.from('source');await exportArtifactLibrary(database([body]),{directory,key});
 const target=database([Buffer.from('existing')]);
 const limited={...env,POD_ARTIFACT_BUDGET_BYTES:'13'};
 for(const budgetBytes of [undefined,134217728]){
  await assert.rejects(restoreArtifactLibrary(target,{directory,key,env:limited,budgetBytes}),/ARCHIVE_BUDGET_EXCEEDED/);
  assert.equal(target.rows.size,1);
 }
 assert.equal((await restoreArtifactLibrary(target,{directory,key,env:{...limited,POD_ARTIFACT_BUDGET_BYTES:'14'}})).inserted,1);
 const invalid=database();
 await assert.rejects(restoreArtifactLibrary(invalid,{directory,key,env:{...env,POD_ARTIFACT_BUDGET_BYTES:''}}),/ARTIFACT_BUDGET_CONFIG_INVALID/);
 assert.equal(invalid.queries.length,0);
 // A lower deployment write limit must not prevent reading an existing backup.
 assert.equal((await verifyArtifactLibrary({directory,key})).objects,1);
});
for(const corrupted of [Buffer.from('SOURCE'),Buffer.from('longer corrupt body')])test('restore rejects existing byte corruption of length '+corrupted.length,async t=>{
 const directory=await workspace(t),body=Buffer.from('source');
 await exportArtifactLibrary(database([body]),{directory,key});
 const target=database([body]);target.rows.get(sha(body)).body=corrupted;
 await assert.rejects(restoreArtifactLibrary(target,{directory,key,env}),/ARCHIVE_RESTORE_CONFLICT/);
 assert.equal(target.rows.size,1);assert.deepEqual(target.rows.get(sha(body)).body,corrupted);
 assert.equal(target.queries.some(sql=>sql.startsWith('INSERT INTO')),false);
});
test('CLI refuses missing keys, enabled publication and unconfirmed restore before connecting',async()=>{
 for(const settings of [{},{...env},{...env,POD_ARCHIVE_KEY:'a'.repeat(64),PUBLICATION_ENABLED:'true'}]){
  await assert.rejects(archiveCLI(['export','/unused-fixture-path'],settings),/ARCHIVE_CLI_CONFIG_INVALID/);
 }
 await assert.rejects(archiveCLI(['restore','/unused-fixture-path'],{...env,POD_ARCHIVE_KEY:'a'.repeat(64)}),/ARCHIVE_RESTORE_NOT_AUTHORIZED/);
});

test('offline verification binds its receipt to the encrypted catalog without database configuration',async t=>{
 const directory=await workspace(t),body=Buffer.from('private-fixture-offline');
 await exportArtifactLibrary(database([body]),{directory,key});
 const before=await fs.readFile(path.join(directory,'catalog.pod'));
 const result=await archiveCLI(['verify',directory],{...env,POD_ARCHIVE_KEY:key.toString('hex')});
 assert.equal(result.status,'VERIFIED');assert.equal(result.scope,'artifacts_only');
 assert.equal(result.objects,1);assert.equal(result.bytes,body.length);
 assert.equal(result.archive_sha256,sha(before));assert.equal(result.publication_enabled,false);
 assert.ok(Number.isFinite(Date.parse(result.created_at)));assert.ok(Number.isFinite(Date.parse(result.verified_at)));
 assert.equal(JSON.stringify(result).includes('private-fixture'),false);
 assert.deepEqual(await fs.readFile(path.join(directory,'catalog.pod')),before);
});

test('offline verification rejects wrong keys, limits, missing bytes and cancellation',async t=>{
 const directory=await workspace(t),body=Buffer.from('fixture');
 await exportArtifactLibrary(database([body]),{directory,key});
 await assert.rejects(verifyArtifactLibrary({directory,key:Buffer.alloc(32,3)}),/ARCHIVE_AUTH_FAILED/);
 await assert.rejects(verifyArtifactLibrary({directory,key,budgetBytes:1}),/ARCHIVE_BUDGET_EXCEEDED/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(verifyArtifactLibrary({directory,key,signal:controller.signal}),e=>e.name==='AbortError');
 await fs.unlink(path.join(directory,sha(body)+'.pod'));
 await assert.rejects(verifyArtifactLibrary({directory,key}),e=>e.code==='ENOENT');
});

test('corrupt archives are rejected before opening a restore transaction',async t=>{
 const directory=await workspace(t),body=Buffer.from('fixture');await exportArtifactLibrary(database([body]),{directory,key});
 const file=path.join(directory,sha(body)+'.pod'),data=await fs.readFile(file);data[data.length-1]^=1;await fs.writeFile(file,data);
 let calls=0;await assert.rejects(restoreArtifactLibrary({tx:async()=>{calls++;throw Error('must not connect');}},
  {directory,key,env}),/ARCHIVE_AUTH_FAILED/);assert.equal(calls,0);
});

test('artifact changes after offline verification still roll back earlier inserts',async t=>{
 const directory=await workspace(t),source=database([Buffer.from('one'),Buffer.from('two')]);
 await exportArtifactLibrary(source,{directory,key});const target=database(),tx=target.tx;
 target.tx=async fn=>{
  const file=path.join(directory,[...source.rows.keys()].sort().at(-1)+'.pod');
  const body=await fs.readFile(file);body[body.length-1]^=1;await fs.writeFile(file,body);
  return tx(fn);
 };
 await assert.rejects(restoreArtifactLibrary(target,{directory,key,env}),/ARCHIVE_AUTH_FAILED/);
 assert.equal(target.queries.filter(sql=>sql.startsWith('INSERT INTO public.pod_artifacts')).length,1);
 assert.equal(target.rows.size,0);
});

test('symlinked roots and artifact entries are rejected',async t=>{
 const directory=await workspace(t),body=Buffer.from('fixture');await exportArtifactLibrary(database([body]),{directory,key});
 const link=directory+'-link';await fs.symlink(directory,link);
 await assert.rejects(verifyArtifactLibrary({directory:link,key}),/ARCHIVE_DIRECTORY_INVALID/);
 const file=path.join(directory,sha(body)+'.pod');await fs.rename(file,file+'.original');await fs.symlink(file+'.original',file);
 await assert.rejects(verifyArtifactLibrary({directory,key}),e=>e.code==='ELOOP');
});

test('FIFO catalog and artifact entries fail promptly without a writer',async t=>{
 const run=promisify(execFile),directory=await workspace(t),body=Buffer.from('fixture');
 await exportArtifactLibrary(database([body]),{directory,key});
 const moduleURL=new URL('../integrations/pod/artifact-archive.mjs',import.meta.url).href;
 for(const name of ['catalog.pod',sha(body)+'.pod']){
  const file=path.join(directory,name);await fs.rename(file,file+'.saved');await run('mkfifo',[file]);
  // A child deadline makes a regression to blocking open fail, not hang CI.
  const code=`import {verifyArtifactLibrary} from ${JSON.stringify(moduleURL)};
   try {await verifyArtifactLibrary({directory:process.argv[1],key:Buffer.alloc(32,7)});process.exitCode=1;}
   catch(error){if(error.message!=='ARCHIVE_SIZE_INVALID')throw error;}`;
  await run(process.execPath,['--input-type=module','-e',code,directory],{timeout:3000});
  await fs.unlink(file);await fs.rename(file+'.saved',file);
 }
});


for(const phase of ['BEGIN','FETCH','COMMIT'])for(const brokenRollback of [false,true]){
 test(`artifact export ${phase} failure with broken rollback=${brokenRollback}`,async t=>{
  const directory=await workspace(t),db=database([Buffer.from('transaction fixture')]);
  const client=await db.pool.connect(),query=client.query.bind(client),calls=[],releases=[];
  const failure=Error('EXPORT_FIXTURE_FAILURE');
  client.query=async(sql,...args)=>{calls.push(sql);
   if(sql.startsWith(phase))throw failure;
   if(sql==='ROLLBACK'&&brokenRollback)throw Error('ROLLBACK_FIXTURE_FAILURE');
   return query(sql,...args);
  };
  client.release=discard=>releases.push(discard);db.pool.connect=async()=>client;
  await assert.rejects(exportArtifactLibrary(db,{directory,key}),error=>error===failure);
  assert.deepEqual(releases,[brokenRollback]);assert.equal(calls.at(-1),'ROLLBACK');
  await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),error=>error.code==='ENOENT');
 });
}
test('artifact successful export returns a clean connection without rollback',async t=>{
 const directory=await workspace(t),db=database([Buffer.from('transaction fixture')]);
 const client=await db.pool.connect(),query=client.query.bind(client),calls=[],releases=[];
 client.query=async(sql,...args)=>{calls.push(sql);return query(sql,...args);};
 client.release=discard=>releases.push(discard);db.pool.connect=async()=>client;
 assert.equal((await exportArtifactLibrary(db,{directory,key})).status,'EXPORTED');
 assert.deepEqual(releases,[false]);assert.equal(calls.at(-1),'COMMIT');
 assert.equal(calls.includes('ROLLBACK'),false);
});
