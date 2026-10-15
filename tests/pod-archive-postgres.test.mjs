import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {migrate} from '../scripts/pod_storage_init.mjs';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {exportArtifactLibrary,restoreArtifactLibrary,verifyArtifactLibrary} from '../integrations/pod/artifact-archive.mjs';

test('encrypted artifacts recover across isolated PostgreSQL databases with restricted roles',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.POD_TEST_DATABASE_URL);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/pod_test')throw Error('DISPOSABLE_TEST_DATABASE_REQUIRED');
 const owner=new pg.Pool({connectionString:url.toString(),max:1});
 const token=crypto.randomUUID().replaceAll('-',''),role='pod_archive_'+token;
 const names=['pod_archive_source_'+token,'pod_archive_target_'+token],pools=[],created=[];
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-pg-archive-')),directory=path.join(root,'archive');
 const key=Buffer.alloc(32,9),env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'};
 const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
 const restricted=pool=>({connect:async()=>{const c=await pool.connect();try{await c.query(`SET ROLE "${role}"`);}catch(e){c.release(true);throw e;}
  return {query:(...args)=>c.query(...args),release:()=>c.release(true)};}});
 let roleCreated=false;
 try{
  await owner.query(`CREATE ROLE "${role}" NOLOGIN`);roleCreated=true;
  for(const name of names){
   await owner.query(`CREATE DATABASE "${name}" TEMPLATE template0`);created.push(name);
   const destination=new URL(url);destination.pathname='/'+name;
   const pool=new pg.Pool({connectionString:destination.toString(),max:2});pools.push(pool);await migrate(pool,role);
  }
  const source=new PodDB({pool:restricted(pools[0]),bridge,expiresAt:new Date(Date.now()+7*86400000).toISOString()}),
   target=new PodDB({pool:restricted(pools[1]),bridge,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
  const store=new ArtifactStore(source),contents=[Buffer.from('first exact fixture bytes'),Buffer.from('second exact fixture bytes')];
  const hashes=await Promise.all(contents.map(body=>store.put(body,'application/json')));
  const receipt=await exportArtifactLibrary(source,{directory,key});assert.equal(receipt.objects,2);
  const verified=await verifyArtifactLibrary({directory,key});assert.equal(verified.objects,2);
  assert.equal(verified.archive_sha256,crypto.createHash('sha256').update(await fs.readFile(path.join(directory,'catalog.pod'))).digest('hex'));
  const broken=path.join(directory,[...hashes].sort().at(-1)+'.pod'),original=await fs.readFile(broken),corrupt=Buffer.from(original);
  corrupt[corrupt.length-1]^=1;await fs.writeFile(broken,corrupt);
  await assert.rejects(restoreArtifactLibrary(target,{directory,key,env}),/ARCHIVE_AUTH_FAILED/);
  assert.equal((await pools[1].query('SELECT count(*)::int AS n FROM public.pod_artifacts')).rows[0].n,0);
  await fs.writeFile(broken,original);
  // The offline pass must not replace in-transaction authentication. Corrupt a
  // later file after the first real INSERT and prove the earlier insert rolls back.
  let insertedBeforeCorruption=false;
  const racingTarget={tx:fn=>target.tx(client=>fn({query:async(sql,args)=>{
   const result=await client.query(sql,args);
   if(sql.startsWith('INSERT INTO public.pod_artifacts')&&!insertedBeforeCorruption){
    insertedBeforeCorruption=true;await fs.writeFile(broken,corrupt);
   }
   return result;
  }}))};
  await assert.rejects(restoreArtifactLibrary(racingTarget,{directory,key,env}),/ARCHIVE_AUTH_FAILED/);
  assert.equal(insertedBeforeCorruption,true);
  assert.equal((await pools[1].query('SELECT count(*)::int AS n FROM public.pod_artifacts')).rows[0].n,0);
  await fs.writeFile(broken,original);
  assert.equal((await restoreArtifactLibrary(target,{directory,key,env})).inserted,2);
  assert.equal((await restoreArtifactLibrary(target,{directory,key,env})).inserted,0);
  // Close every pooled connection and verify persisted bytes after reconnect.
  await Promise.all(pools.map(pool=>pool.end()));pools.length=0;
  const restoredURL=new URL(url);restoredURL.pathname='/'+names[1];
  const reopened=new pg.Pool({connectionString:restoredURL.toString(),max:1});pools.push(reopened);
  for(const [index,hash] of hashes.entries())assert.deepEqual((await reopened.query('SELECT body FROM public.pod_artifacts WHERE sha256=$1',[hash])).rows[0].body,contents[index]);
  assert.equal((await reopened.query('SELECT count(*)::int AS n FROM pod_production_queue')).rows[0].n,0);
  assert.equal((await reopened.query('SELECT count(*)::int AS n FROM pod_accounts')).rows[0].n,0);
  // A failed restore must leave a separate destination transaction unchanged.
  await fs.writeFile(broken,corrupt);
  const targetAgain=new PodDB({pool:restricted(reopened),bridge,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
  await assert.rejects(restoreArtifactLibrary(targetAgain,{directory,key,env}),/ARCHIVE_AUTH_FAILED/);
  assert.equal((await reopened.query('SELECT count(*)::int AS n FROM public.pod_artifacts')).rows[0].n,2);
 }finally{
  await Promise.all(pools.map(pool=>pool.end()));
  for(const name of created.reverse())await owner.query(`DROP DATABASE "${name}"`);
  if(roleCreated)await owner.query(`DROP ROLE "${role}"`);
  await owner.end();await fs.rm(root,{recursive:true,force:true});
 }
});

