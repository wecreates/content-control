import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const accountId='account',jobId='job',qaKey='synthetic-publish-query-qa-key-'.repeat(2);
const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
 package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
  'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
 JSON.stringify(value);
const manifestSha256=crypto.createHash('sha256').update(canonical(manifest)).digest('hex');
const qaPayload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-100,
 expires_at_ms:Date.now()+60000,verdict:'PASS',package_sha256:manifest.package_sha256,
 template_sha256:manifest.template_sha256,checks:Object.fromEntries(
  ['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance'].map(name=>[name,true]))});
const qaEnvelope={payload:qaPayload,signature:crypto.createHmac('sha256',qaKey).update(qaPayload).digest('hex')};
const brief={id:jobId,account_id:accountId,platform:'redbubble'};
const ready={id:jobId,account_id:accountId,platform:'redbubble',fencing_token:'0',attempt:0,
 brief,manifest,qa_envelope:qaEnvelope,idempotency_key:'idem',state:'qa_passed',manifest_sha256:manifestSha256};
const candidate={id:ready.id,account_id:ready.account_id,platform:ready.platform,manifest:ready.manifest,
 qa_envelope:ready.qa_envelope,manifest_sha256:ready.manifest_sha256};
const claimed={id:jobId,account_id:accountId,platform:'redbubble',fencing_token:'1',attempt:1,
 brief,manifest,qa_envelope:qaEnvelope,idempotency_key:'idem',state:'publishing'};

function fixture(overrides={}){
 const mutations=[];
 const db=new PodDB({bridge,qaKey,expiresAt:'2099-01-01T00:00:00Z'});
 db.tx=async fn=>fn({query:async(sql,args=[])=>{
  if(sql.startsWith('SELECT id FROM pod_accounts'))return overrides.lock??{rows:[{id:accountId}]};
  if(sql.startsWith('SELECT id,platform,daily_cap FROM pod_accounts'))return overrides.account??{rows:[{id:accountId,platform:'redbubble',daily_cap:10}]};
  if(sql.startsWith('SELECT true AS present FROM pod_production_queue'))return overrides.busy??{rows:[]};
  if(sql.startsWith('SELECT count(*)::int AS n FROM pod_quota_reservations'))return overrides.daily??{rows:[{n:0}]};
  if(sql.startsWith('SELECT q.id,q.account_id,q.platform,q.manifest,q.qa_envelope,'))return overrides.candidate??{rows:[candidate]};
  if(sql.startsWith('UPDATE pod_production_queue')){
   mutations.push(['queue',args]);return {rowCount:1,rows:[claimed]};
  }
  if(sql.startsWith('INSERT INTO pod_quota_reservations')){
   mutations.push(['quota',args]);return {rowCount:1,rows:[{job_id:jobId,attempt:1,account_id:accountId}]};
  }
  if(sql.startsWith('UPDATE pod_accounts')){
   mutations.push(['account',args]);return {rowCount:1,rows:[{id:accountId}]};
  }
  throw Error(`UNEXPECTED_QUERY: ${sql}`);
 }});
 return {db,mutations};
}

async function rejectsExecutable(overrides,reads){
 const {db,mutations}=fixture(overrides);
 await assert.rejects(db.claimPublish(accountId,45),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads(),0);
 assert.deepEqual(mutations,[]);
}

test('publish claim rejects accessor-backed account-lock rows without invoking them',async()=>{
 let count=0;const lock={};
 Object.defineProperty(lock,'rows',{enumerable:true,get(){count++;return [{id:accountId}];}});
 await rejectsExecutable({lock},()=>count);
});

test('publish claim rejects accessor-backed account evidence without invoking it',async()=>{
 let count=0;const account={id:accountId,daily_cap:10};
 Object.defineProperty(account,'platform',{enumerable:true,get(){count++;return 'redbubble';}});
 await rejectsExecutable({account:{rows:[account]}},()=>count);
});

test('publish claim rejects accessor-backed busy-query rows without invoking them',async()=>{
 let count=0;const busy={};
 Object.defineProperty(busy,'rows',{enumerable:true,get(){count++;return [];}});
 await rejectsExecutable({busy},()=>count);
});

test('publish claim rejects accessor-backed daily quota evidence without invoking it',async()=>{
 let count=0;const daily={};
 Object.defineProperty(daily,'n',{enumerable:true,get(){count++;return 0;}});
 await rejectsExecutable({daily:{rows:[daily]}},()=>count);
});

test('publish claim rejects accessor-backed candidate manifests without invoking them',async()=>{
 let count=0;const executable={...candidate};delete executable.manifest;
 Object.defineProperty(executable,'manifest',{enumerable:true,get(){count++;return manifest;}});
 await rejectsExecutable({candidate:{rows:[executable]}},()=>count);
});
