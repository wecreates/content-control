import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-authority-expiry-key-'.repeat(2);
const job={id:'fixture-job',business_id:'fixture-business',account_id:'fixture-account',
 platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
const cases=[
 {name:'new concept',intake:true},
 {name:'duplicate concept',intake:true,duplicate:true},
 {name:'adverse duplicate evidence',intake:true,duplicate:true,rights:'UNKNOWN'},
 {name:'enqueue'},
 {name:'repair',repair:true}
];
async function exercise(spec,stage,expired){
 const originalNow=Date.now,issued=originalNow();let now=issued;
 Date.now=()=>now;
 try{
  const payload=JSON.stringify({schema_version:1,issued_at_ms:issued-1,expires_at_ms:issued+1000,
   audience:spec.intake?'content-control:pod:intake':'content-control:pod',
   ...(spec.intake?{concept_id:'fixture-concept',business_id:job.business_id,fingerprint:'fixture-fingerprint',rights_state:spec.rights||'PASS'}:
    {job_id:job.id,business_id:job.business_id,account_id:job.account_id,platform:job.platform,
     revoked:false,max_mode:'PRELAUNCH',production_permission:true,publication_permission:false})});
  const envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
  const queries=[];
  const advance=()=>{now=issued+(expired?1000:999);};
  const client={release(){},query:async sql=>{
   sql=typeof sql==='string'?sql:sql.text;
   queries.push(sql);
   if(stage==='database'&&/^(SELECT|UPDATE|INSERT)/.test(sql))advance();
   if(sql.includes('AS budget_day'))return {rows:[{budget_day:'2026-10-16'}]};
   if(sql.includes('FROM pod_concepts WHERE fingerprint='))return {rows:spec.duplicate?
    [{id:'existing-concept',business_id:job.business_id,rights_state:'PASS',permanently_unpublished:false}]:[]};
   if(sql.includes('SELECT * FROM pod_concepts'))return {rows:[{business_id:job.business_id,rights_state:'PASS',permanently_unpublished:false}]};
   if(sql.includes('SELECT q.*'))return {rows:[{id:job.id,brief:job,attempt:1,manifest:{},qa_envelope:{}}]};
   return {rows:[{id:job.id,used:1}]};
  }};
  const db=new PodDB({pool:{connect:async()=>{if(stage==='connection')advance();return client;}},
   bridge,upstreamKey:key,expiresAt:'2099-01-01T00:00:00Z'});
  const run=()=>spec.intake?db.registerIntake({id:'fixture-concept',businessId:job.business_id,envelope,intakeKey:key}):
   spec.repair?db.requeueRepair(job.id,envelope):db.enqueue({job,upstream:envelope,conceptId:'fixture-concept',revision:1});
  if(expired){
   await assert.rejects(run(),/ENVELOPE_EXPIRED_OR_INVALID/);
   assert.equal(queries.includes('COMMIT'),false);assert.equal(queries.at(-2),'ROLLBACK');
  }else{
   await run();assert.equal(queries.at(-2),'COMMIT');
   if(spec.repair)assert.match(queries.find(q=>q.includes('SELECT q.*')),/FOR SHARE OF p/);
  }
 }finally{Date.now=originalNow;}
}
for(const spec of cases){
 for(const stage of ['connection','database'])test('expired authorization rolls back '+spec.name+' after '+stage+' wait',()=>exercise(spec,stage,true));
 test('current authorization permits '+spec.name,()=>exercise(spec,'database',false));
}
