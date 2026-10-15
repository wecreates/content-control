import crypto from 'node:crypto';
export const MAX_PACKAGE_BYTES=64*1024*1024;

// Bounded PostgreSQL backend for the initial free-tier lane. Large libraries must
// use an independently verified durable object-store implementation of this contract.
export class ArtifactStore {
 constructor(db,{budgetBytes=128*1024*1024,maxObjectBytes=16*1024*1024,maxBatchBytes=MAX_PACKAGE_BYTES}={}){
  if(!Number.isSafeInteger(budgetBytes)||budgetBytes<1||!Number.isSafeInteger(maxObjectBytes)||maxObjectBytes<1||maxObjectBytes>16777216||
   !Number.isSafeInteger(maxBatchBytes)||maxBatchBytes<1||maxBatchBytes>MAX_PACKAGE_BYTES)throw Error('ARTIFACT_LIMIT_INVALID');
  Object.assign(this,{db,budgetBytes,maxObjectBytes,maxBatchBytes});
 }
 async put(body,mediaType){
  return (await this.putMany([{body,mediaType}]))[0];
 }
 async putMany(artifacts){
  if(!Array.isArray(artifacts)||artifacts.length>32)throw Error('ARTIFACT_BATCH_INVALID');
  const unique=new Map(),hashes=[];let total=0;
  for(const artifact of artifacts){
   const {body,mediaType}=artifact||{};
   if(!Buffer.isBuffer(body)||!body.length||body.length>this.maxObjectBytes||!['image/png','application/pdf','application/json','font/ttf'].includes(mediaType))throw Error('ARTIFACT_INVALID');
   total+=body.length;if(total>this.maxBatchBytes)throw Error('ARTIFACT_BATCH_TOO_LARGE');
   const sha=crypto.createHash('sha256').update(body).digest('hex');hashes.push(sha);
   if(!unique.has(sha))unique.set(sha,{body,mediaType});
  }
  if(!hashes.length)return [];
  return this.db.tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock($1)',[543211]);
   const existing=new Set((await c.query('SELECT sha256 FROM pod_artifacts WHERE sha256=ANY($1::text[])',[[...unique.keys()]])).rows.map(row=>row.sha256));
   const missing=[...unique].filter(([sha])=>!existing.has(sha));
   if(!missing.length)return hashes;
   const used=BigInt((await c.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts')).rows[0].bytes);
   const needed=missing.reduce((sum,[,artifact])=>sum+BigInt(artifact.body.length),0n);
   if(used+needed>BigInt(this.budgetBytes))throw Error('ARTIFACT_BUDGET_EXHAUSTED');
   for(const [sha,{body,mediaType}] of missing)await c.query('INSERT INTO pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)',[sha,body,mediaType]);
   return hashes;
  });
 }
 async get(sha){
  this.db.active();if(!/^[a-f0-9]{64}$/.test(sha))throw Error('ARTIFACT_HASH_INVALID');
  const row=(await this.db.pool.query('SELECT body,media_type FROM pod_artifacts WHERE sha256=$1',[sha])).rows[0];
  if(!row||crypto.createHash('sha256').update(row.body).digest('hex')!==sha)throw Error('ARTIFACT_UNAVAILABLE');
  return row;
 }
}
