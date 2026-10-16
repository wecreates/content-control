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
   // Callers retain ownership of their mutable buffers. Hash and persist one
   // private snapshot so a lock/connection wait cannot separate identity/bytes.
   const snapshot=Buffer.from(body);
   const sha=crypto.createHash('sha256').update(snapshot).digest('hex');hashes.push(sha);
   const previous=unique.get(sha);
   if(previous&&(previous.mediaType!==mediaType||!previous.body.equals(snapshot)))throw Error('ARTIFACT_CONFLICT');
   if(!previous)unique.set(sha,{body:snapshot,mediaType});
  }
  if(!hashes.length)return [];
  return this.db.tx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock($1)',[543211]);
   const existing=new Set();
   // Hash presence alone is insufficient: legacy corrupt bytes or conflicting
   // immutable media metadata must not be reported as a successful replay.
   // Compute existing digests in PostgreSQL to avoid fetching duplicate blobs
   // into the low-memory Node process. No pgcrypto extension is required.
   for(const row of (await c.query("SELECT sha256,media_type,encode(sha256(body),'hex') AS body_sha256 FROM pod_artifacts WHERE sha256=ANY($1::text[])",[[...unique.keys()]])).rows){
    const expected=unique.get(row.sha256);
    if(!expected||row.media_type!==expected.mediaType||row.body_sha256!==row.sha256)throw Error('ARTIFACT_CONFLICT');
    existing.add(row.sha256);
   }
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
  this.db.active();if(typeof sha!=='string'||!/^[a-f0-9]{64}$/.test(sha))throw Error('ARTIFACT_HASH_INVALID');
  // Reject oversized legacy/foreign rows in PostgreSQL before their bodies
  // cross into the low-memory process. Apply the same per-object read/write cap.
  const row=(await this.db.pool.query('SELECT body,media_type FROM pod_artifacts WHERE sha256=$1 AND octet_length(body) BETWEEN 1 AND $2',[sha,this.maxObjectBytes])).rows[0];
  this.db.active();
  if(!row||!Buffer.isBuffer(row.body)||!row.body.length||row.body.length>this.maxObjectBytes||
   crypto.createHash('sha256').update(row.body).digest('hex')!==sha)throw Error('ARTIFACT_UNAVAILABLE');
  return row;
 }
}
