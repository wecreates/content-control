import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {exportArtifactLibrary,restoreArtifactLibrary} from '../integrations/pod/artifact-archive.mjs';
import {archiveCLI} from '../scripts/pod_artifact_archive.mjs';
const key=Buffer.alloc(32,7),env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'};
const sha=body=>crypto.createHash('sha256').update(body).digest('hex');
function database(values=[]){
 const rows=new Map(values.map(body=>[sha(body),{body,media_type:'application/json'}]));let queries=[],index=0;
 const query=async(sql,args=[])=>{
  queries.push(sql);
  if(sql.startsWith('DECLARE')){index=0;return {rows:[]};}
  if(sql.startsWith('FETCH')){const entries=[...rows].sort(([a],[b])=>a.localeCompare(b));const item=entries[index++];return {rows:item?[{sha256:item[0],...item[1]}]:[]};}
  if(sql.includes('COALESCE(sum'))return {rows:[{bytes:String([...rows.values()].reduce((n,x)=>n+x.body.length,0))}]};
  if(sql.startsWith('SELECT body,media_type'))return {rows:rows.has(args[0])?[rows.get(args[0])]:[]};
  if(sql.startsWith('INSERT INTO public.pod_artifacts')){rows.set(args[0],{body:args[1],media_type:args[2]});return {rows:[]};}
  if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT pg_advisory)/.test(sql))return {rows:[]};
  throw Error('UNEXPECTED_QUERY');
 };
 return {rows,queries,pool:{connect:async()=>({query,release(){}})},tx:async fn=>{
  const snapshot=new Map(rows);try{return await fn({query});}catch(e){rows.clear();for(const [k,v] of snapshot)rows.set(k,v);throw e;}
 }};
}
async function workspace(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-archive-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return path.join(root,'archive');}
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
test('export never overwrites a directory and incomplete export has no catalog',async t=>{
 const directory=await workspace(t),source=database([Buffer.from('one')]);
 await assert.rejects(exportArtifactLibrary(source,{directory,key,budgetBytes:1}),/ARCHIVE_BUDGET_EXCEEDED/);
 await assert.rejects(fs.stat(path.join(directory,'catalog.pod')),e=>e.code==='ENOENT');
 await assert.rejects(exportArtifactLibrary(source,{directory,key}),e=>e.code==='EEXIST');
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
test('CLI refuses missing keys, enabled publication and unconfirmed restore before connecting',async()=>{
 for(const settings of [{},{...env},{...env,POD_ARCHIVE_KEY:'a'.repeat(64),PUBLICATION_ENABLED:'true'}]){
  await assert.rejects(archiveCLI(['export','/unused-fixture-path'],settings),/ARCHIVE_CLI_CONFIG_INVALID/);
 }
 await assert.rejects(archiveCLI(['restore','/unused-fixture-path'],{...env,POD_ARCHIVE_KEY:'a'.repeat(64)}),/ARCHIVE_RESTORE_NOT_AUTHORIZED/);
});
