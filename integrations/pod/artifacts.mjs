import crypto from 'node:crypto';

// Bounded PostgreSQL backend for the initial free-tier lane. Large libraries must
// use an independently verified durable object-store implementation of this contract.
export class ArtifactStore {
 constructor(db,{budgetBytes=128*1024*1024,maxObjectBytes=16*1024*1024}={}){
  if(!Number.isSafeInteger(budgetBytes)||budgetBytes<1||!Number.isSafeInteger(maxObjectBytes)||maxObjectBytes<1||maxObjectBytes>16777216)throw Error('ARTIFACT_LIMIT_INVALID');
  Object.assign(this,{db,budgetBytes,maxObjectBytes});
 }
 async put(body,mediaType){
  if(!Buffer.isBuffer(body)||!body.length||body.length>this.maxObjectBytes||!['image/png','application/pdf','application/json'].includes(mediaType))throw Error('ARTIFACT_INVALID');
  const sha=crypto.createHash('sha256').update(body).digest('hex');
  return this.db.tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock($1)',[543211]);
   if((await c.query('SELECT 1 FROM pod_artifacts WHERE sha256=$1',[sha])).rowCount)return sha;
   const used=BigInt((await c.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts')).rows[0].bytes);
   if(used+BigInt(body.length)>BigInt(this.budgetBytes))throw Error('ARTIFACT_BUDGET_EXHAUSTED');
   await c.query('INSERT INTO pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)',[sha,body,mediaType]);
   return sha;
  });
 }
 async get(sha){
  this.db.active();if(!/^[a-f0-9]{64}$/.test(sha))throw Error('ARTIFACT_HASH_INVALID');
  const row=(await this.db.pool.query('SELECT body,media_type FROM pod_artifacts WHERE sha256=$1',[sha])).rows[0];
  if(!row||crypto.createHash('sha256').update(row.body).digest('hex')!==sha)throw Error('ARTIFACT_UNAVAILABLE');
  return row;
 }
}
