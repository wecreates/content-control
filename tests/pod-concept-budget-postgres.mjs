import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
export async function verifyConceptBudget(pool,bridge){
 const key='synthetic-concept-budget-key-'.repeat(2),business=crypto.randomUUID();
 const intake=(businessId=business)=>{
  const id=crypto.randomUUID(),payload=JSON.stringify({schema_version:1,audience:'content-control:pod:intake',
   issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,concept_id:id,business_id:businessId,
   fingerprint:crypto.randomUUID(),rights_state:'PASS'});
  return {id,businessId,intakeKey:key,dailyLimit:2,envelope:{payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}};
 };
 const settings={bridge,expiresAt:'2099-01-01T00:00:00Z'},db=new PodDB({pool,...settings});
 const rolloverBusiness=crypto.randomUUID(),blockedBusiness=crypto.randomUUID(),aliasBusiness=crypto.randomUUID(),unicodeBusiness=crypto.randomUUID();
 try{
  const results=await Promise.allSettled(Array.from({length:3},()=>db.registerIntake(intake())));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,2);
  assert.equal(results.find(x=>x.status==='rejected').reason.message,'DAILY_CONCEPT_LIMIT');
  assert.equal((await pool.query('SELECT used FROM pod_daily_concept_budget WHERE business_id=$1',[business])).rows[0].used,2);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_concepts WHERE business_id=$1',[business])).rows[0].n,2);

  // Native pg text encoding can make a number or array alias an opaque string.
  // A signed malformed fingerprint must not deduplicate/tombstone that record.
  const signed=(fingerprint,rights_state='PASS',businessId=aliasBusiness)=>{
   const request=intake(businessId),payload=JSON.stringify({...JSON.parse(request.envelope.payload),fingerprint,rights_state});
   return {...request,envelope:{payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}};
  };
  for(const value of [crypto.randomInt(100000000,1000000000),['fixture-'+crypto.randomUUID()]]){
   const fingerprint=(await pool.query('SELECT $1::text AS fingerprint',[value])).rows[0].fingerprint;
   const canonical=await db.registerIntake(signed(fingerprint));
   await assert.rejects(db.registerIntake(signed(value,'UNKNOWN')),/^Error: INTAKE_SCOPE_INVALID$/);
   const row=(await pool.query('SELECT fingerprint,rights_state,permanently_unpublished FROM pod_concepts WHERE id=$1',[canonical.id])).rows[0];
   assert.deepEqual(row,{fingerprint,rights_state:'PASS',permanently_unpublished:false});
   assert.deepEqual(await db.registerIntake(signed(fingerprint)),{id:canonical.id});
  }
  assert.equal((await pool.query('SELECT used FROM pod_daily_concept_budget WHERE business_id=$1',[aliasBusiness])).rows[0].used,2);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_concepts WHERE business_id=$1',[aliasBusiness])).rows[0].n,2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE kind='pod.concept.rights_blocked' AND payload->>'business_id'=$1",[aliasBusiness])).rows[0].n,0);

  // UTF-8 encoding also replaces unpaired surrogates in primitive strings.
  // Confirm the actual driver alias, then prove malformed signed text cannot
  // revoke a registered literal replacement character or consume budget.
  for(const suffix of ['\ud800','\udfff']){
   const value='unicode-'+crypto.randomUUID()+suffix;
   const fingerprint=(await pool.query('SELECT $1::text AS fingerprint',[value])).rows[0].fingerprint;
   assert.notEqual(fingerprint,value);assert.equal(fingerprint,value.slice(0,-1)+'\ufffd');
   const canonical=await db.registerIntake(signed(fingerprint,'PASS',unicodeBusiness));
   await assert.rejects(db.registerIntake(signed(value,'UNKNOWN',unicodeBusiness)),/^Error: INTAKE_SCOPE_INVALID$/);
   assert.deepEqual((await pool.query('SELECT fingerprint,rights_state,permanently_unpublished FROM pod_concepts WHERE id=$1',[canonical.id])).rows[0],
    {fingerprint,rights_state:'PASS',permanently_unpublished:false});
   assert.deepEqual(await db.registerIntake(signed(fingerprint,'PASS',unicodeBusiness)),{id:canonical.id});
  }
  assert.equal((await pool.query('SELECT used FROM pod_daily_concept_budget WHERE business_id=$1',[unicodeBusiness])).rows[0].used,2);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_concepts WHERE business_id=$1',[unicodeBusiness])).rows[0].n,2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE kind='pod.concept.rights_blocked' AND payload->>'business_id'=$1",[unicodeBusiness])).rows[0].n,0);

  // Controlled clock responses simulate midnight; all budget/concept writes and
  // the subsequent rollback are real PostgreSQL transactions, not an in-memory DB.
  let reads=0;
  const rollover=new PodDB({...settings,pool:{connect:async()=>{
   const c=await pool.connect();return {release:bad=>c.release(bad),query:async(sql,args)=>
    sql.includes('AS budget_day')?{rows:[{budget_day:++reads===1?'2026-10-16':'2026-10-17'}]}:c.query(sql,args)};
  }}});
  await assert.rejects(rollover.registerIntake(intake(rolloverBusiness)),/CONCEPT_BUDGET_DAY_CHANGED/);
  for(const table of ['pod_concepts','pod_daily_concept_budget'])assert.equal(
   (await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE business_id=$1`,[rolloverBusiness])).rows[0].n,0);

  // Actual advisory-lock barrier proves the real UTC clock is read only after
  // the business lock, rather than at transaction start or before the wait.
  const blocker=await pool.connect();let workerPid,pending,clockReads=0;
  const waitingDB=new PodDB({...settings,pool:{connect:async()=>{
   const c=await pool.connect();workerPid=(await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
   return {release:bad=>c.release(bad),query:async(sql,args)=>{if(sql.includes('AS budget_day'))clockReads++;return c.query(sql,args);}};
  }}});
  try{
   await blocker.query('BEGIN');await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['pod:concept-budget:'+blockedBusiness]);
   pending=waitingDB.registerIntake(intake(blockedBusiness)).then(value=>({value}),error=>({error}));
   let waiting=false;
   for(let attempt=0;attempt<100;attempt++){
    if(workerPid)waiting=(await pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS waiting',[workerPid])).rows[0].waiting;
    if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert.equal(waiting,true);assert.equal(clockReads,0);
   const released=(await blocker.query('SELECT clock_timestamp() AS at')).rows[0].at;
   await blocker.query('COMMIT');const result=await pending;if(result.error)throw result.error;
   assert.equal(clockReads,2);
   const row=(await pool.query("SELECT c.created_at,b.day=(c.created_at AT TIME ZONE 'UTC')::date AS same_day FROM pod_concepts c JOIN pod_daily_concept_budget b USING(business_id) WHERE c.id=$1",[result.value.id])).rows[0];
   assert.ok(row.created_at>=released);assert.equal(row.same_day,true);
  }finally{await blocker.query('ROLLBACK');blocker.release();if(pending)await pending;}
 }finally{
  await pool.query("DELETE FROM pod_events WHERE kind='pod.concept.rights_blocked' AND payload->>'business_id'=ANY($1::text[])",[[aliasBusiness,unicodeBusiness]]);
  await pool.query('DELETE FROM pod_concepts WHERE business_id=ANY($1::text[])',[[business,rolloverBusiness,blockedBusiness,aliasBusiness,unicodeBusiness]]);
  await pool.query('DELETE FROM pod_daily_concept_budget WHERE business_id=ANY($1::text[])',[[business,rolloverBusiness,blockedBusiness,aliasBusiness,unicodeBusiness]]);
 }
}
