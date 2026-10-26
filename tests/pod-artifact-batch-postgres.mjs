import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';

export async function verifyArtifactBatch(pool,db){
 const item=()=>({body:Buffer.from(crypto.randomUUID().padEnd(64,'.')),mediaType:'application/json'});
 const sha=entry=>crypto.createHash('sha256').update(entry.body).digest('hex');
 const used=async()=>Number((await pool.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts')).rows[0].bytes);
 const count=async entries=>(await pool.query('SELECT count(*)::int AS n FROM pod_artifacts WHERE sha256=ANY($1::text[])',[entries.map(sha)])).rows[0].n;
 const initial=await used(),tooLarge=[item(),item()];
 await assert.rejects(new ArtifactStore(db,{budgetBytes:initial+64}).putMany(tooLarge),/ARTIFACT_BUDGET_EXHAUSTED/);
 assert.equal(await count(tooLarge),0);assert.equal(await used(),initial);

 // Real transaction rollback after the first INSERT, not a mock commit map.
 const rollbackItems=[item(),item()];let inserts=0;
 const interrupted={active:()=>db.active(),tx:fn=>db.tx(client=>fn({query:async(sql,args)=>{
  if((typeof sql==='string'?sql:sql.text).startsWith('INSERT INTO pod_artifacts')&&++inserts===2)throw Error('SYNTHETIC_SECOND_INSERT_FAILURE');
  return client.query(sql,args);
 }}))};
 await assert.rejects(new ArtifactStore(interrupted).putMany(rollbackItems),/SYNTHETIC_SECOND_INSERT_FAILURE/);
 assert.equal(inserts,2);assert.equal(await count(rollbackItems),0);assert.equal(await used(),initial);

 const a=[item(),item()],b=[item(),item()],store=new ArtifactStore(db,{budgetBytes:initial+128});
 const outcomes=await Promise.allSettled([store.putMany(a),store.putMany(b)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(x=>x.status==='rejected'&&x.reason.message==='ARTIFACT_BUDGET_EXHAUSTED').length,1);
 const winner=outcomes[0].status==='fulfilled'?a:b,loser=winner===a?b:a;
 assert.equal(await count(winner),2);assert.equal(await count(loser),0);assert.equal(await used(),initial+128);
 // Exact replay and repeated hashes consume no new durable bytes at full budget.
 assert.deepEqual(await store.putMany([winner[0],winner[1],winner[0]]),[sha(winner[0]),sha(winner[1]),sha(winner[0])]);
 assert.equal(await used(),initial+128);
 const extra=item();
 await assert.rejects(store.putMany([winner[0],extra]),/ARTIFACT_BUDGET_EXHAUSTED/);
 assert.equal(await count([extra]),0);assert.equal(await used(),initial+128);
 // The real SQL must exclude an oversized body before pg receives it. The
 // same immutable row remains readable at its exact size and is not altered.
 const readBytes=[],readDB={active:()=>db.active(),read:async(sql,args)=>{
  const result=await pool.query(sql,args);
  readBytes.push(result.rows.reduce((n,row)=>n+(row.body?.length||0),0));
  return result;
 }};
 await assert.rejects(new ArtifactStore(readDB,{maxObjectBytes:63}).get(sha(winner[0])),/ARTIFACT_UNAVAILABLE/);
 assert.deepEqual(readBytes,[0]);
 assert.deepEqual((await new ArtifactStore(readDB,{maxObjectBytes:64}).get(sha(winner[0]))).body,winner[0].body);
 assert.deepEqual(readBytes,[0,64]);
 assert.equal(await used(),initial+128);assert.equal(await count(winner),2);
 // Mutate caller-owned bytes while the real transaction awaits its lock query.
 const mutable=item(),original=Buffer.from(mutable.body),originalSha=sha(mutable);
 const racingDB={active:()=>db.active(),tx:fn=>db.tx(client=>fn({query:async(sql,args)=>{
  const result=await client.query(sql,args);
  if((typeof sql==='string'?sql:sql.text).includes('pg_advisory_xact_lock'))mutable.body.fill(120);
  return result;
 }}))};
 assert.equal(await new ArtifactStore(racingDB).put(mutable.body,mutable.mediaType),originalSha);
 assert.deepEqual((await pool.query('SELECT body FROM pod_artifacts WHERE sha256=$1',[originalSha])).rows[0].body,original);
 const untouched=item(),beforeConflict=await used();
 await assert.rejects(new ArtifactStore(db).putMany([untouched,{body:original,mediaType:'image/png'}]),/ARTIFACT_CONFLICT/);
 assert.equal(await count([untouched]),0);assert.equal(await used(),beforeConflict);
 // Two writers for the same bytes but incompatible media metadata cannot both
 // claim success. The shared advisory lock serializes conflict detection.
 const raced=item(),racedStore=new ArtifactStore(db);
 const mediaRace=await Promise.allSettled([racedStore.put(raced.body,'image/png'),racedStore.put(raced.body,'application/pdf')]);
 assert.equal(mediaRace.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(mediaRace.filter(r=>r.status==='rejected'&&r.reason.message==='ARTIFACT_CONFLICT').length,1);
 assert.equal(await count([raced]),1);
 // Reproduce a legacy mismatched hash/body row in disposable CI only. Never
 // silently accept its key as a valid idempotent upload or rewrite its bytes.
 const corrupted=item(),wrongBody=item(),pending=item();
 await pool.query('INSERT INTO pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)',[sha(corrupted),wrongBody.body,corrupted.mediaType]);
 await assert.rejects(new ArtifactStore(db).putMany([pending,corrupted]),/ARTIFACT_CONFLICT/);
 assert.equal(await count([pending]),0);
 assert.deepEqual((await pool.query('SELECT body FROM pod_artifacts WHERE sha256=$1',[sha(corrupted)])).rows[0].body,wrongBody.body);
 // Invalid legacy media metadata is filtered before the blob crosses into
 // the application, even when its immutable hash and size are otherwise valid.
 const unsupported=item();
 await pool.query('INSERT INTO pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)',[sha(unsupported),unsupported.body,'text/html']);
 await assert.rejects(new ArtifactStore(readDB).get(sha(unsupported)),/ARTIFACT_UNAVAILABLE/);
 assert.deepEqual(readBytes,[0,64,0]);
 // These small immutable fixtures remain only in disposable CI PostgreSQL.
}
