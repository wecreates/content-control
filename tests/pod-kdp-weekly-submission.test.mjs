import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const qaKey='q'.repeat(48);
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:
 JSON.stringify(value);
const releaseManifest=platform=>({schema_version:1,platform,publication_enabled:false,
 package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:Object.fromEntries(
  (platform==='kdp'?['art-mask.png','cover.pdf','interior.pdf','interior.receipt.json','print.png','text-mask.png']:
   ['art-mask.png','print.png','text-mask.png']).map((name,index)=>[name,(index+1).toString(16).repeat(64)]))});
const signedQA=manifest=>{
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-100,
  expires_at_ms:Date.now()+60000,verdict:'PASS',package_sha256:manifest.package_sha256,
  template_sha256:manifest.template_sha256,checks:Object.fromEntries([
   'text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance',
   'editorial','template_provenance','manuscript_provenance','source_font','font_rights','book_details','regional_rights'
  ].map(key=>[key,true]))});
 return {payload,signature:crypto.createHmac('sha256',qaKey).update(payload).digest('hex')};
};

function fixture({platform='kdp',prior=false,weekly=0,priorResult,weeklyResult}={}){
 const manifest=releaseManifest(platform);
 const job={id:'00000000-0000-4000-8000-000000000001',account_id:'00000000-0000-4000-8000-000000000002',
  platform,state:'qa_passed',attempt:0,fencing_token:'0',manifest,brief:{id:'fixture'},idempotency_key:'fixture-key',
  manifest_sha256:crypto.createHash('sha256').update(canonical(manifest)).digest('hex'),qa_envelope:signedQA(manifest)};
 const queries=[];
 const client={
  async query(sql,params=[]){
   if(typeof sql!=='string'){params=sql.values??params;sql=sql.text;}
   queries.push({sql,params});
   if(sql==='BEGIN'||sql==='BEGIN READ ONLY')return {command:'BEGIN'};
   if(sql==='COMMIT')return {command:'COMMIT'};
   if(sql==='BEGIN'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql==='SELECT id FROM pod_accounts WHERE id=$1 FOR UPDATE')return {rows:[{id:job.account_id}]};
   if(sql.startsWith('SELECT id,platform,daily_cap FROM pod_accounts'))return {rows:[{id:job.account_id,platform,daily_cap:10}]};
   if(sql.startsWith('SELECT true AS present FROM pod_production_queue WHERE account_id='))return {rows:[]};
   if(sql.startsWith('SELECT count(*)::int AS n FROM pod_quota_reservations'))return {rows:[{n:0}]};
   if(sql.startsWith('SELECT q.id,q.account_id,q.platform,q.manifest,q.qa_envelope,'))return {rows:[{
    id:job.id,account_id:job.account_id,platform:job.platform,manifest:job.manifest,
    qa_envelope:job.qa_envelope,manifest_sha256:job.manifest_sha256}]};
   if(sql.startsWith('SELECT true AS present FROM pod_quota_reservations r JOIN pod_production_queue'))return priorResult??{rows:prior?[{present:true}]:[]};
   if(sql.startsWith('SELECT count(DISTINCT r.job_id)::int AS n'))return weeklyResult??{rows:[{n:weekly}]};
   if(sql.startsWith('UPDATE pod_production_queue SET state=')){
    const {manifest_sha256,...claimed}={...job,state:'publishing',attempt:1,fencing_token:'1'};
    return {rowCount:1,rows:[claimed]};
   }
   if(sql.startsWith('INSERT INTO pod_quota_reservations'))
    return {rowCount:1,rows:[{job_id:job.id,attempt:1,account_id:job.account_id}]};
   if(sql.startsWith('UPDATE pod_accounts'))return {rowCount:1,rows:[{id:job.account_id}]};
   throw Error('unexpected SQL: '+sql);
  },
  release(){}
 };
 const db=new PodDB({bridge,qaKey,expiresAt:'2099-01-01T00:00:00Z',pool:{connect:async()=>client}});
 return {db,job,queries};
}

test('KDP blocks a third distinct paperback title in the current Sunday UTC week',async()=>{
 const {db,job,queries}=fixture({weekly:2});
 assert.equal(await db.claimPublish(job.account_id,45),null);
 const check=queries.find(({sql})=>sql.startsWith('SELECT count(DISTINCT r.job_id)::int AS n'));
 assert.ok(check);
 assert.match(check.sql,/q\.platform='kdp'/);
 assert.match(check.sql,/AT TIME ZONE 'UTC'/);
 assert.match(check.sql,/interval '1 day'/);
 assert.equal(queries.some(({sql})=>sql.startsWith('UPDATE pod_production_queue SET state=')),false);
 assert.equal(queries.some(({sql})=>sql.startsWith('INSERT INTO pod_quota_reservations')),false);
 const prior=queries.find(({sql})=>sql.startsWith('SELECT true AS present FROM pod_quota_reservations r JOIN pod_production_queue'));
 assert.match(prior.sql,/provider_id IS NOT NULL/);
 assert.match(prior.sql,/AT TIME ZONE 'UTC'/);
});

test('KDP allows first and second distinct titles and records the attempt',async()=>{
 for(const weekly of [0,1]){
  const {db,job,queries}=fixture({weekly});
  const claimed=await db.claimPublish(job.account_id,45);
  assert.equal(claimed.id,job.id);
  assert.equal(claimed.state,'publishing');
  assert.ok(queries.some(({sql})=>sql.startsWith('INSERT INTO pod_quota_reservations')));
 }
});

test('KDP retry or update of an already submitted durable job does not consume a new weekly title',async()=>{
 const {db,job,queries}=fixture({prior:true,weekly:2});
 assert.equal((await db.claimPublish(job.account_id,45)).id,job.id);
 assert.equal(queries.some(({sql})=>sql.startsWith('SELECT count(DISTINCT r.job_id)::int AS n')),false);
});

test('non-KDP accounts retain the rolling daily cap without a KDP weekly query',async()=>{
 const {db,job,queries}=fixture({platform:'redbubble',weekly:2});
 assert.equal((await db.claimPublish(job.account_id,45)).id,job.id);
 assert.equal(queries.some(({sql})=>sql.startsWith('SELECT true AS present FROM pod_quota_reservations r JOIN pod_production_queue')),false);
 assert.equal(queries.some(({sql})=>sql.startsWith('SELECT count(DISTINCT r.job_id)::int AS n')),false);
});

test('KDP claim rejects accessor-backed prior-submission evidence without invoking it',async()=>{
 let reads=0;const priorResult={};
 Object.defineProperty(priorResult,'rows',{enumerable:true,get(){reads++;return [];}});
 const {db,job}=fixture({priorResult});
 await assert.rejects(db.claimPublish(job.account_id,45),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});

test('KDP claim rejects accessor-backed weekly quota evidence without invoking it',async()=>{
 let reads=0;const row={};
 Object.defineProperty(row,'n',{enumerable:true,get(){reads++;return 0;}});
 const {db,job}=fixture({weeklyResult:{rows:[row]}});
 await assert.rejects(db.claimPublish(job.account_id,45),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});
