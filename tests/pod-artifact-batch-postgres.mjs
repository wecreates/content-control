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
 const interrupted={tx:fn=>db.tx(client=>fn({query:async(sql,args)=>{
  if(sql.startsWith('INSERT INTO pod_artifacts')&&++inserts===2)throw Error('SYNTHETIC_SECOND_INSERT_FAILURE');
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
 // These small immutable fixtures remain only in disposable CI PostgreSQL.
}
