import crypto from 'node:crypto';
import {assertBridge,enforceBrief,verifyEnvelope,enforceQA,PLATFORMS} from './integrations/pod/policy.mjs';
import {ARTIFACT_MEDIA_TYPES} from './integrations/pod/artifacts.mjs';
import {assertPackageFormat,PACKAGE_MEDIA_TYPES} from './integrations/pod/package-artifacts.mjs';
import {productionReason} from './integrations/pod/failure-reasons.mjs';
import {monitorPodPool} from './integrations/pod/pool-health.mjs';
import {validOpaqueText} from './integrations/pod/text-identity.mjs';
import {parseStorageExpiry,validDateMs} from './integrations/pod/storage-expiry.mjs';
const REVIEW_FILE=/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,99}$/;
const REVIEW_JOB=/^[a-zA-Z0-9_-]{1,100}$/;
const SHA256=/^[a-f0-9]{64}$/;
const artifactMediaTypes=new Set(ARTIFACT_MEDIA_TYPES);
const BASE_REVIEW_FILES=Object.freeze(['art-mask.png','print.png','text-mask.png']);
const KDP_REVIEW_FILES=Object.freeze([...BASE_REVIEW_FILES,'cover.pdf','interior.pdf','interior.receipt.json'].sort());
const RELEASE_REASONS=Object.freeze({ambiguous:'SUBMISSION_UNCERTAIN',blocked:'RELEASE_BLOCKED'});
const TRANSACTION_COMMANDS=new Set(['ABORT','BEGIN','COMMIT','END','PREPARE','RELEASE','ROLLBACK','SAVEPOINT','START']);
function exactObject(value,keys){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&
  JSON.stringify(Object.keys(value).sort())===JSON.stringify(keys);
}
function assertSettlement(state,receipt,reason){
 if(state==='submitted'){
  if(!exactObject(receipt,['id'])||!validOpaqueText(receipt.id))throw Error('RECEIPT_INVALID');
  if(reason!==null)throw Error('SETTLEMENT_INVALID');
  return;
 }
 if(!exactObject(receipt,[])||reason!==RELEASE_REASONS[state])throw Error('SETTLEMENT_INVALID');
}
function canonical(value){
 return Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
  value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
  JSON.stringify(value);
}
function firstSqlCommand(text){
 let offset=0;
 while(offset<text.length){
  while(offset<text.length&&/[\s;]/.test(text[offset]))offset++;
  if(text.startsWith('--',offset)){
   const newline=text.slice(offset+2).search(/[\r\n]/);offset=newline<0?text.length:offset+newline+3;continue;
  }
  if(text.startsWith('/*',offset)){
   let depth=1;offset+=2;
   while(offset<text.length&&depth){
    if(text.startsWith('/*',offset)){depth++;offset+=2;}
    else if(text.startsWith('*/',offset)){depth--;offset+=2;}
    else offset++;
   }
   if(depth) return '';
   continue;
  }
  break;
 }
 return /^[a-z]+/i.exec(text.slice(offset))?.[0].toUpperCase()||'';
}
function assertManagedTransactionStatement(text){
 if(typeof text==='string'&&TRANSACTION_COMMANDS.has(firstSqlCommand(text)))throw Error('POD_TRANSACTION_CONTROL_FORBIDDEN');
}
function assertStoredManifest(manifest,platform,manifestSha256,state={nodes:0},depth=0){
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||manifest.schema_version!==1||
  manifest.platform!==platform||manifest.publication_enabled!==false||!SHA256.test(manifest.package_sha256||'')||
  !SHA256.test(manifestSha256||''))throw Error('PACKAGE_UNAVAILABLE');
 const files=manifest.files;
 if(!files||typeof files!=='object'||Array.isArray(files)||Object.keys(files).length<1||Object.keys(files).length>64)throw Error('PACKAGE_UNAVAILABLE');
 const expected=platform==='kdp'?KDP_REVIEW_FILES:BASE_REVIEW_FILES;
 if(JSON.stringify(Object.keys(files).sort())!==JSON.stringify(expected))throw Error('PACKAGE_UNAVAILABLE');
 for(const [name,hash] of Object.entries(files))if(!REVIEW_FILE.test(name)||name==='manifest.json'||typeof hash!=='string'||!SHA256.test(hash))throw Error('PACKAGE_UNAVAILABLE');
 const inspect=(value,level)=>{
  if(level>64||++state.nodes>10000)throw Error('PACKAGE_UNAVAILABLE');
  if(typeof value==='number'&&(!Number.isFinite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value))))throw Error('PACKAGE_UNAVAILABLE');
  if(Array.isArray(value)){if(value.length>10000)throw Error('PACKAGE_UNAVAILABLE');for(const item of value)inspect(item,level+1);}
  else if(value&&typeof value==='object'){const keys=Object.keys(value);if(keys.length>10000)throw Error('PACKAGE_UNAVAILABLE');for(const key of keys)inspect(value[key],level+1);}
 };
 inspect(manifest,depth);
 if(crypto.createHash('sha256').update(canonical(manifest)).digest('hex')!==manifestSha256)throw Error('PACKAGE_UNAVAILABLE');
}
async function conceptBudgetDay(client){
 const day=(await client.query("SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date::text AS budget_day")).rows[0]?.budget_day;
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('CONCEPT_BUDGET_CLOCK_INVALID');
 return day;
}
async function lockProductionLease(client,job){
 const current=(await client.query("SELECT id FROM pod_production_queue WHERE id=$1 AND fencing_token=$2 AND state='processing' FOR UPDATE",[job.id,job.fencing_token])).rows[0];
 if(!current)throw Error('LEASE_LOST');
 // Evaluate wall time in a separate statement after acquiring the row lock.
 // now() is fixed at BEGIN, and a SELECT expression can run before a lock wait.
 const lease=(await client.query('SELECT lease_until>clock_timestamp() AS valid FROM pod_production_queue WHERE id=$1',[job.id])).rows[0];
 if(lease?.valid!==true)throw Error('LEASE_LOST');
}
async function lockPublishingLease(client,job){
 const current=(await client.query("SELECT id FROM pod_production_queue WHERE id=$1 AND fencing_token=$2 AND state='publishing' FOR UPDATE",[job.id,job.fencing_token])).rows[0];
 if(!current)throw Error('LEASE_LOST');
 // The provider call can outlive its release lease. Check wall time only after
 // acquiring the row lock so a stale publisher cannot commit a late outcome.
 const lease=(await client.query('SELECT lease_until>clock_timestamp() AS valid FROM pod_production_queue WHERE id=$1',[job.id])).rows[0];
 if(lease?.valid!==true)throw Error('LEASE_LOST');
}
export async function createPodPool(env=process.env) {
 const {default:pg}=await import('pg');
 let u;try{u=new URL(env.POD_DATABASE_URL);}catch{throw Error('POD_DATABASE_REQUIRED');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.username||!u.password||u.pathname.length<2||
  u.hash||[...u.searchParams.keys()].some(k=>k!=='sslmode')||
  (u.searchParams.has('sslmode')&&!['require','verify-full'].includes(u.searchParams.get('sslmode')))) throw Error('POD_DATABASE_INVALID');
 const pool=new pg.Pool({host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),
  password:decodeURIComponent(u.password),database:decodeURIComponent(u.pathname.slice(1)),
  ssl:{rejectUnauthorized:true},options:'-c search_path=pg_catalog,public',
  max:2,connectionTimeoutMillis:10000,query_timeout:15000,idleTimeoutMillis:10000});
 Object.defineProperty(pool,'podConnectionHealth',{value:monitorPodPool(pool)});
 return pool;
}
export class PodDB {
 constructor({pool,bridge,upstreamKey,qaKey,expiresAt}) {
  assertBridge(bridge);Object.assign(this,{pool,upstreamKey,qaKey,expiresAt:parseStorageExpiry(expiresAt)});
 }
 active(){
  const now=Date.now();
  if(!validDateMs(now)||!validDateMs(this.expiresAt)||
   this.expiresAt-now<=86400000)throw Error('POD_STORAGE_EXPIRING');
 }
 async read(sql,values){
  this.active();const c=await this.pool.connect();let bad=false,began=false;
  try{
   // Pool acquisition and transaction setup can cross the retention cutoff.
   // Keep every shared read in a database-enforced read-only transaction so a
   // mistaken future caller cannot mutate durable state through this helper.
   this.active();await c.query('BEGIN READ ONLY');began=true;this.active();
   await c.query("SET LOCAL statement_timeout='10s'");this.active();
   // Force the extended protocol even for parameterless reads. PostgreSQL's
   // simple-query protocol accepts multiple statements, which could otherwise
   // end this read-only transaction before a later statement in the same call.
   // The caller owns only the read statement, not this helper's transaction.
   // Extended protocol rejects multiple statements but still accepts a lone
   // COMMIT or ROLLBACK, so reject transaction control before PostgreSQL can
   // end the managed read transaction early.
   assertManagedTransactionStatement(sql);
   const result=await c.query({text:sql,values:values??[],queryMode:'extended'});this.active();await c.query('COMMIT');return result;
  }catch(error){if(began)try{await c.query('ROLLBACK');}catch{bad=true;}throw error;
  }finally{c.release(bad);}
 }
 async registerIntake({id,businessId,envelope,intakeKey,dailyLimit=100}){
  if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>1000)throw Error('CONCEPT_LIMIT_INVALID');
  const intake=verifyEnvelope(envelope,intakeKey,'content-control:pod:intake');
  if(!validOpaqueText(id)||!validOpaqueText(businessId)||intake.concept_id!==id||intake.business_id!==businessId||
    typeof intake.fingerprint!=='string'||intake.fingerprint.trim().length===0||
    intake.fingerprint.includes('\0')||Buffer.from(intake.fingerprint,'utf8').toString('utf8')!==intake.fingerprint||
    !['PASS','FAIL','UNKNOWN'].includes(intake.rights_state))throw Error('INTAKE_SCOPE_INVALID');
  return this.tx(async c=>{
   // Serialize fingerprint deduplication so duplicate retries never consume unique-concept budget.
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[intake.fingerprint]);
   const found=await c.query('SELECT id,business_id,rights_state,permanently_unpublished FROM pod_concepts WHERE fingerprint=$1 FOR UPDATE',[intake.fingerprint]);
   if(found.rows.length){
    const existing=found.rows[0];
    if(existing.business_id!==businessId)throw Error('INTAKE_FINGERPRINT_CONFLICT');
    // Deduplication saves concept budget, never discards newly adverse evidence.
    // Preserve an existing tombstone exactly; even later PASS cannot revive it.
    if(intake.rights_state!=='PASS'&&!existing.permanently_unpublished){
     await c.query('UPDATE pod_concepts SET rights_state=$2,permanently_unpublished=true WHERE id=$1',[existing.id,intake.rights_state]);
     await c.query('INSERT INTO pod_events(id,kind,payload) VALUES($1,$2,$3)',[crypto.randomUUID(),'pod.concept.rights_blocked',
      {concept_id:existing.id,business_id:businessId,rights_state:intake.rights_state,
       intake_sha256:crypto.createHash('sha256').update(envelope.payload).digest('hex'),publication_enabled:false}]);
    }
    verifyEnvelope(envelope,intakeKey,'content-control:pod:intake');
    return {id:existing.id};
   }
   // Serialize a business's admission budget before selecting wall-clock UTC day.
   // Transaction-start now() can be yesterday after a fingerprint/budget wait.
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['pod:concept-budget:'+businessId]);
   const day=await conceptBudgetDay(c);
   await c.query('INSERT INTO pod_daily_concept_budget(business_id,day) VALUES($1,$2::date) ON CONFLICT DO NOTHING',[businessId,day]);
   const budget=await c.query('UPDATE pod_daily_concept_budget SET used=used+1 WHERE business_id=$1 AND day=$2::date AND used<$3 RETURNING used',[businessId,day,dailyLimit]);
   if(!budget.rows.length)throw Error('DAILY_CONCEPT_LIMIT');
   await c.query('INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state,permanently_unpublished,created_at) VALUES($1,$2,$3,$4,$5,clock_timestamp())',[id,businessId,intake.fingerprint,intake.rights_state,intake.rights_state!=='PASS']);
   if(await conceptBudgetDay(c)!==day)throw Error('CONCEPT_BUDGET_DAY_CHANGED');
   // Revalidate after all database waits so expiry rolls back budget and writes.
   verifyEnvelope(envelope,intakeKey,'content-control:pod:intake');
   return {id};
  });
 }
 async requeueRepair(jobId,upstream){
  const grant=verifyEnvelope(upstream,this.upstreamKey,'content-control:pod');
  // A current grant may authorize only its exact repair target. Reject wrong
  // or lossy route identities before acquiring or locking database rows.
  if(!validOpaqueText(jobId)||!validOpaqueText(grant.job_id)||grant.job_id!==jobId)throw Error('GRANT_SCOPE_MISMATCH');
  return this.tx(async c=>{
   // Only an expired internal production lease is recoverable from blocked.
   // Publication ambiguity and other blocked reasons must never become raw.
   const j=(await c.query(`SELECT q.* FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
    WHERE q.id=$1 AND (q.state='qa_failed' OR (q.state='blocked' AND q.reason_code='PRODUCTION_LEASE_EXPIRED'
      AND q.lease_until<=clock_timestamp() AND q.provider_id IS NULL))
    AND q.attempt<3 AND p.rights_state='PASS' AND NOT p.permanently_unpublished
    FOR UPDATE OF q FOR SHARE OF p`,[jobId])).rows[0];
   if(!j)throw Error('REPAIR_BLOCKED');enforceBrief(grant,j.brief);
   await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),j.id,'pod.repair.archived',{attempt:j.attempt,manifest:j.manifest,qa_envelope:j.qa_envelope,reason_code:productionReason(j.reason_code)}]);
   await c.query("UPDATE pod_production_queue SET state='raw',reason_code=NULL,manifest=NULL,qa_envelope=NULL,lease_until=NULL,upstream_envelope=$2,next_attempt_at=now(),updated_at=now() WHERE id=$1",[jobId,upstream]);
   verifyEnvelope(upstream,this.upstreamKey,'content-control:pod');
  });
 }
 async tx(fn){
  this.active();const c=await this.pool.connect();let bad=false,began=false;
  try{
   // Connection acquisition and transaction setup are asynchronous too. Do
   // not let a retention cutoff crossed in those waits reach business SQL.
   this.active();await c.query('BEGIN');began=true;this.active();
   await c.query("SET LOCAL lock_timeout='2s'");this.active();
   await c.query("SET LOCAL statement_timeout='10s'");this.active();
   // A callback may await non-database work between statements (for example,
   // archive file verification). Check on both sides so crossing the retention
   // cutoff in that wait cannot issue one last business statement.
   // Force every callback business statement through the extended protocol,
   // including parameterless statements. The simple-query protocol accepts a
   // multi-command string that could COMMIT early and run a later command
   // outside this helper's transaction and retention checks.
   const guardedQuery=async(query,values)=>{
    this.active();
    const config=typeof query==='string'?{text:query,values:values??[],queryMode:'extended'}:{...query,queryMode:'extended'};
    // The callback owns business SQL, not the transaction. Extended protocol
    // rejects multi-command strings, but a standalone COMMIT/ROLLBACK would
    // still end this managed transaction and could make an eventual rollback
    // unable to undo earlier writes. Reject transaction-control commands before
    // PostgreSQL can execute them, including comment-obscured forms.
    assertManagedTransactionStatement(config.text);
    const result=await c.query(config);this.active();return result;
   };
   // Expose a query-only capability, never the pooled client. In particular,
   // release() could return this still-open transaction to the pool before the
   // helper commits or rolls it back, while connection internals could bypass
   // the guarded query path entirely.
   const facade=Object.freeze(Object.assign(Object.create(null),{query:guardedQuery}));
   const forbidden=()=>{throw Error('POD_TRANSACTION_CLIENT_CONTROL_FORBIDDEN');};
   const guarded=new Proxy(facade,{
    get:(_,property)=>property==='query'?guardedQuery:forbidden(),
    set:forbidden,defineProperty:forbidden,deleteProperty:forbidden,
   });
   const r=await fn(guarded);this.active();await c.query('COMMIT');return r;
  }catch(e){if(began)try{await c.query('ROLLBACK');}catch{bad=true;}throw e;}finally{c.release(bad);}
 }
 async enqueue({job,upstream,conceptId,revision}) {
  const grant=verifyEnvelope(upstream,this.upstreamKey,'content-control:pod');
  const brief=enforceBrief(grant,job);
  // Validate queue-only scope before connection acquisition. PostgreSQL uuid
  // and int4 coercion must not decide whether malformed input is admissible.
  if(!validOpaqueText(conceptId)||!Number.isInteger(revision)||revision<1||revision>2147483647)throw Error('QUEUE_SCOPE_INVALID');
  return this.tx(async c=>{
   const {rows}=await c.query('SELECT * FROM pod_concepts WHERE id=$1 FOR SHARE',[conceptId]);
   if(rows[0]?.rights_state!=='PASS'||rows[0]?.permanently_unpublished||rows[0]?.business_id!==job.business_id)throw Error('RIGHTS_BLOCKED');
   const key=crypto.createHash('sha256').update(JSON.stringify([conceptId,job.account_id,revision])).digest('hex');
   const r=await c.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [job.id,conceptId,job.account_id,job.platform,revision,brief,upstream,key]);
   if(!r.rows.length)throw Error('DUPLICATE_JOB');
   verifyEnvelope(upstream,this.upstreamKey,'content-control:pod');return r.rows[0];
  });
 }
 async listReady(){this.active();
  return (await this.read("SELECT q.id,q.platform,q.state FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id WHERE q.state='qa_passed' AND p.rights_state='PASS' AND NOT p.permanently_unpublished ORDER BY q.created_at LIMIT 20")).rows;
 }
 async listOperationsJobs(state='review_required'){
  if(!['review_required','raw','processing','qa_failed','qa_passed','blocked','publishing','ambiguous','submitted','published'].includes(state))throw Error('JOB_FILTER_INVALID');
  this.active();
  const rows=(await this.read(`SELECT id,platform,
   CASE WHEN state='qa_failed' AND reason_code='REVIEW_REQUIRED' THEN 'review_required' ELSE state END AS state,
   reason_code,attempt,created_at,manifest IS NOT NULL AS can_preview FROM pod_production_queue
   WHERE CASE WHEN state='qa_failed' AND reason_code='REVIEW_REQUIRED' THEN 'review_required' ELSE state END=$1
   ORDER BY created_at DESC,id DESC LIMIT 50`,[state])).rows;
  return rows.map(row=>({...row,reason_code:row.reason_code===null?null:productionReason(row.reason_code)}));
 }
 async failProduction(job,reason){return this.tx(async c=>{
  await lockProductionLease(c,job);
  const r=await c.query("UPDATE pod_production_queue SET state='qa_failed',reason_code=$1,lease_until=NULL,updated_at=now() WHERE id=$2 AND fencing_token=$3 AND state='processing' AND lease_until>clock_timestamp() RETURNING id",[productionReason(reason),job.id,job.fencing_token]);
  if(!r.rows.length)throw Error('LEASE_LOST');
 });}
 async claimProduction(){return this.tx(async c=>{
  // Lock acquisition can outlive a retry deadline. Eligibility and the new
  // lease must use wall time, not the timestamp frozen at transaction BEGIN.
  const r=await c.query(`UPDATE pod_production_queue SET state='processing',lease_until=clock_timestamp()+interval '30 minutes',
   fencing_token=fencing_token+1,attempt=attempt+1,updated_at=clock_timestamp()
   WHERE id=(SELECT q.id FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
    WHERE q.state='raw' AND q.next_attempt_at<=clock_timestamp() AND p.rights_state='PASS' AND NOT p.permanently_unpublished
    ORDER BY q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1) RETURNING *`);return r.rows[0]||null;
 });}
 async assertProducible(job){return this.tx(async c=>{
  const current=(await c.query(`SELECT q.id FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
   WHERE q.id=$1 AND q.fencing_token=$2 AND q.account_id=$3 AND q.platform=$4
   AND q.state='processing' AND p.rights_state='PASS' AND NOT p.permanently_unpublished
   FOR SHARE OF q,p`,[job.id,job.fencing_token,job.account_id,job.platform])).rows[0];
  if(!current)throw Error('LOCAL_PRODUCTION_BLOCKED');
  // A queued lock acquisition must not preserve an expired production lease.
  const lease=(await c.query('SELECT lease_until>clock_timestamp() AS valid FROM pod_production_queue WHERE id=$1',[job.id])).rows[0];
  if(lease?.valid!==true)throw Error('LOCAL_PRODUCTION_BLOCKED');
  return true;
 });}
 async holdProduction(job,manifest){return this.tx(async c=>{
  await lockProductionLease(c,job);
  const r=await c.query("UPDATE pod_production_queue SET state='qa_failed',reason_code='REVIEW_REQUIRED',manifest=$1,lease_until=NULL,updated_at=now() WHERE id=$2 AND fencing_token=$3 AND state='processing' AND lease_until>clock_timestamp() RETURNING id",[manifest,job.id,job.fencing_token]);
  if(!r.rows.length)throw Error('LEASE_LOST');
  await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),job.id,'pod.production.review_required',
   {package_sha256:manifest.package_sha256,manifest_sha256:crypto.createHash('sha256').update(canonical(manifest)).digest('hex'),publication_enabled:false}]);
 });}
 async acceptReview(jobId,qaEnvelope){
  verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
  // Authenticate first, then reject malformed route identities before a
  // connection or query parameter. Review artifacts already use this bound.
  if(typeof jobId!=='string'||!REVIEW_JOB.test(jobId))throw Error('REVIEW_NOT_PENDING');
  return this.tx(async c=>{
   const job=(await c.query("SELECT q.* FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id WHERE q.id=$1 AND q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED' AND p.rights_state='PASS' AND NOT p.permanently_unpublished FOR UPDATE OF q FOR SHARE OF p",[jobId])).rows[0];
   if(!job)throw Error('REVIEW_NOT_PENDING');
   // Authentication before connection acquisition cannot authorize an expired
   // review after pool or row-lock waits. Revalidate at the state transition.
   enforceQA(verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa'),job.manifest.package_sha256,job.manifest.template_sha256,job.platform);
   await c.query("UPDATE pod_production_queue SET state='qa_passed',qa_envelope=$2,reason_code=NULL,updated_at=now() WHERE id=$1",[jobId,qaEnvelope]);
   await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),jobId,'pod.production.qa_passed',{package_sha256:job.manifest.package_sha256,publication_enabled:false}]);
   verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
   return {status:'QA_PASSED',publication_enabled:false};
  });
 }
 async reviewPackage(jobId){this.active();
  if(typeof jobId!=='string'||!REVIEW_JOB.test(jobId))throw Error('PACKAGE_UNAVAILABLE');
  const row=(await this.read(`SELECT q.id,q.platform,q.state,q.reason_code,q.manifest,
   (SELECT e.payload->>'manifest_sha256' FROM pod_events e WHERE e.job_id=q.id
    AND e.kind='pod.production.review_required' AND e.payload ? 'manifest_sha256'
    ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS manifest_sha256
   FROM pod_production_queue q
   WHERE q.id=$1 AND q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED'`,[jobId])).rows[0];
  if(!row?.manifest||row.state!=='qa_failed'||row.reason_code!=='REVIEW_REQUIRED'||!PLATFORMS.includes(row.platform))throw Error('PACKAGE_UNAVAILABLE');
  assertStoredManifest(row.manifest,row.platform,row.manifest_sha256);
  this.active();
  return row;
 }
 async reviewArtifact(jobId,sha){this.active();
  if(typeof jobId!=='string'||!REVIEW_JOB.test(jobId)||typeof sha!=='string'||!SHA256.test(sha))throw Error('ARTIFACT_UNAVAILABLE');
  // Resolve the hold, manifest and bytes in one database snapshot. A bearer
  // key and a known content hash alone must not expose unrelated stored data.
  const row=(await this.read(`SELECT q.id,q.platform,q.state,q.reason_code,q.manifest,
   (SELECT e.payload->>'manifest_sha256' FROM pod_events e WHERE e.job_id=q.id
    AND e.kind='pod.production.review_required' AND e.payload ? 'manifest_sha256'
    ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS manifest_sha256,
   a.body,a.media_type
   FROM pod_production_queue q JOIN pod_artifacts a ON a.sha256=$2
   WHERE q.id=$1 AND q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED'
   AND octet_length(a.body) BETWEEN 1 AND $3 AND a.media_type=ANY($4::text[])`,
   [jobId,sha,16777216,ARTIFACT_MEDIA_TYPES])).rows[0];
  if(!row||row.id!==jobId||row.state!=='qa_failed'||row.reason_code!=='REVIEW_REQUIRED'||
   !Buffer.isBuffer(row.body)||!row.body.length||row.body.length>16777216||!artifactMediaTypes.has(row.media_type))throw Error('ARTIFACT_UNAVAILABLE');
  assertStoredManifest(row.manifest,row.platform,row.manifest_sha256);
  const members=Object.entries(row.manifest.files).filter(([,digest])=>digest===sha);
  if(!members.length||members.some(([name])=>PACKAGE_MEDIA_TYPES[name]!==row.media_type)||
   crypto.createHash('sha256').update(row.body).digest('hex')!==sha)throw Error('ARTIFACT_UNAVAILABLE');
  try{for(const [name] of members)assertPackageFormat(name,row.body);}
  catch{throw Error('ARTIFACT_UNAVAILABLE');}
  this.active();
  return {body:row.body,media_type:row.media_type};
 }
 async completeProduction(job,manifest,qaEnvelope){
  const qa=verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
  const pass=(()=>{try{enforceQA(qa,manifest.package_sha256,manifest.template_sha256,job.platform);return true;}catch{return false;}})();
  return this.tx(async c=>{
   await lockProductionLease(c,job);
   if(pass){
    // Lock current rights through the readiness transition; a prior claim or
    // signed technical QA does not authorize a subsequently revoked concept.
    const current=(await c.query(`SELECT p.rights_state,p.permanently_unpublished
     FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
     WHERE q.id=$1 AND q.fencing_token=$2 AND q.state='processing'
     FOR UPDATE OF q FOR SHARE OF p`,[job.id,job.fencing_token])).rows[0];
    if(!current)throw Error('LEASE_LOST');
    if(current.rights_state!=='PASS'||current.permanently_unpublished)throw Error('RIGHTS_BLOCKED');
   }
   const currentQA=verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
   if(pass)enforceQA(currentQA,manifest.package_sha256,manifest.template_sha256,job.platform);
   const r=await c.query(`UPDATE pod_production_queue SET state=$1,reason_code=CASE WHEN $1='qa_passed' THEN NULL ELSE 'QA_FAILED' END,manifest=$2,qa_envelope=$3,lease_until=NULL,updated_at=now()
    WHERE id=$4 AND fencing_token=$5 AND state='processing' AND lease_until>clock_timestamp() RETURNING id`,
    [pass?'qa_passed':'qa_failed',manifest,qaEnvelope,job.id,job.fencing_token]);
   if(!r.rows.length)throw Error('LEASE_LOST');
   await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',
    [crypto.randomUUID(),job.id,pass?'pod.production.qa_passed':'pod.production.qa_failed',
     {package_sha256:manifest.package_sha256,manifest_sha256:crypto.createHash('sha256').update(canonical(manifest)).digest('hex'),
      fencing_token:job.fencing_token,publication_enabled:false}]);
   verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
   return {pass};
  });
 }
 async claimPublish(accountId,delaySeconds){
  if(!Number.isInteger(delaySeconds)||delaySeconds<45||delaySeconds>180)throw Error('PUBLISH_DELAY_INVALID');
  return this.tx(async c=>{
  // A transaction rollback prevents an expired store from committing, but it
  // does not stop later queue/quota mutations from being issued. Recheck the
  // retention boundary after every awaited SQL statement.
  const query=async(sql,args)=>{const result=await c.query(sql,args);this.active();return result;};
  // Acquire the account lock first, then evaluate cooldown on the live clock.
  // A predicate in the locking SELECT can be evaluated before its lock wait.
  const locked=(await query('SELECT id FROM pod_accounts WHERE id=$1 FOR UPDATE',[accountId])).rows[0];
  if(!locked)return null;
  const a=(await query("SELECT * FROM pod_accounts WHERE id=$1 AND state='ACTIVE' AND next_allowed_at<=clock_timestamp()",[accountId])).rows[0];
  if(!a)return null;
  const busy=await query("SELECT 1 FROM pod_production_queue WHERE account_id=$1 AND state IN ('publishing','ambiguous') LIMIT 1",[accountId]);
  if(busy.rows.length)return null;
  const count=(await query("SELECT count(*)::int AS n FROM pod_quota_reservations WHERE account_id=$1 AND reserved_at>clock_timestamp()-interval '24 hours'",[accountId])).rows[0].n;
  if(count>=a.daily_cap)return null;
  // Bind the account lock to its configured marketplace before consuming quota
  // or moving a job into publishing. A later release check is not early enough:
  // a mismatched queued row must remain untouched and must not reserve capacity.
  const j=(await query(`SELECT q.* FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
   WHERE q.account_id=$1 AND q.platform=$2 AND q.state='qa_passed' AND q.next_attempt_at<=clock_timestamp()
   AND p.rights_state='PASS' AND NOT p.permanently_unpublished
   ORDER BY q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1`,[accountId,a.platform])).rows[0];
  if(!j)return null;
  if(a.platform==='kdp'){
   // KDP currently counts a title only on its first submission and resets its
   // per-format weekly allowance every Sunday at 00:00 UTC. This lane supports
   // paperback only. A retry/update of the same durable job therefore does not
   // consume another weekly title, while a third distinct job fails closed.
   const prior=(await query(`SELECT 1 FROM pod_quota_reservations r JOIN pod_production_queue q ON q.id=r.job_id
    WHERE r.account_id=$1 AND r.job_id=$2 AND (q.provider_id IS NOT NULL OR
     r.reserved_at>=((date_trunc('week',(clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day')-interval '1 day') AT TIME ZONE 'UTC'))
    LIMIT 1`,[accountId,j.id])).rows.length>0;
   if(!prior){
    const weekly=(await query(`SELECT count(DISTINCT r.job_id)::int AS n
     FROM pod_quota_reservations r JOIN pod_production_queue q ON q.id=r.job_id
     WHERE r.account_id=$1 AND q.platform='kdp'
     AND r.reserved_at>=((date_trunc('week',(clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day')-interval '1 day') AT TIME ZONE 'UTC')`,[accountId])).rows[0].n;
    if(weekly>=2)return null;
   }
  }
  const r=await query("UPDATE pod_production_queue SET state='publishing',attempt=attempt+1,fencing_token=fencing_token+1,lease_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() WHERE id=$1 RETURNING *",[j.id]);
  // Override the schema's transaction-time default: reservations must not age
  // while the claimant is waiting for the account lock.
  await query('INSERT INTO pod_quota_reservations(job_id,attempt,account_id,reserved_at) VALUES($1,$2,$3,clock_timestamp())',[j.id,r.rows[0].attempt,accountId]);
  await query("UPDATE pod_accounts SET next_allowed_at=clock_timestamp()+($2::double precision*interval '1 second') WHERE id=$1",[accountId,delaySeconds]);
  return r.rows[0];
 });}
 async assertPublishable(job){return this.tx(async c=>{
  const current=(await c.query(`SELECT q.id FROM pod_production_queue q
   JOIN pod_concepts p ON p.id=q.concept_id JOIN pod_accounts a ON a.id=q.account_id AND a.platform=q.platform
   WHERE q.id=$1 AND q.fencing_token=$2 AND q.account_id=$3 AND q.platform=$4
   AND q.state='publishing' AND p.rights_state='PASS' AND NOT p.permanently_unpublished AND a.state='ACTIVE'
   FOR SHARE OF q,p,a`,[job.id,job.fencing_token,job.account_id,job.platform])).rows[0];
  if(!current)throw Error('LOCAL_RELEASE_BLOCKED');
  // Evaluate the live clock after row-lock waits, not transaction-start now().
  const lease=(await c.query('SELECT lease_until>clock_timestamp() AS valid FROM pod_production_queue WHERE id=$1',[job.id])).rows[0];
  if(lease?.valid!==true)throw Error('LOCAL_RELEASE_BLOCKED');
  return true;
 });}
 async finish(job,state,receipt={},reason=null){
  if(!['blocked','ambiguous','submitted'].includes(state))throw Error('INVALID_FINISH');
  // Settlement is a narrow durable boundary, not a generic adapter log sink.
  // Persist only the opaque provider ID or the exact fixed failure outcome;
  // reject extra fields and arbitrary reason text before database access.
  assertSettlement(state,receipt,reason);
  const providerId=state==='submitted'?receipt.id:null;
  const eventPayload=state==='submitted'?{id:receipt.id}:{};
  return this.tx(async c=>{
   await lockPublishingLease(c,job);
   const r=await c.query(`UPDATE pod_production_queue SET state=$1,provider_id=$2,reason_code=$3,lease_until=NULL,updated_at=now()
    WHERE id=$4 AND fencing_token=$5 AND state='publishing' AND lease_until>clock_timestamp() RETURNING id`,[state,providerId,reason,job.id,job.fencing_token]);
   if(!r.rows.length)throw Error('LEASE_LOST');
   await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),job.id,'pod.'+state,eventPayload]);
  });
 }
 async recover(){return this.tx(async c=>{
  // Relation/row-lock waits can outlive a lease. BEGIN's frozen now() must
  // not defer already-expired work to another sweep or misdate its transition.
  await c.query("UPDATE pod_production_queue SET state='ambiguous',reason_code='LEASE_EXPIRED',updated_at=clock_timestamp() WHERE state='publishing' AND lease_until<clock_timestamp()");
  await c.query("UPDATE pod_production_queue SET state='blocked',reason_code='PRODUCTION_LEASE_EXPIRED',updated_at=clock_timestamp() WHERE state='processing' AND lease_until<clock_timestamp()");
 });}
 async close(){await this.pool.end();}
}



