import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',
 contract:{fail_closed_rules:BRIDGE_RULES}};
const accountId='account',jobId='job',qaKey='synthetic-publish-claim-qa-key-'.repeat(2);
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
const exactQueue={rowCount:1,rows:[claimed]};
const exactQuota={rowCount:1,rows:[{job_id:jobId,attempt:1,account_id:accountId}]};
const exactAccount={rowCount:1,rows:[{id:accountId}]};

function fixture({queue=exactQueue,quota=exactQuota,account=exactAccount}={}){
 const mutations=[];
 const db=new PodDB({bridge,qaKey,expiresAt:'2099-01-01T00:00:00Z'});
 db.tx=async fn=>fn({query:async(sql,args=[])=>{
  if(sql.startsWith('SELECT id FROM pod_accounts'))return {rows:[{id:accountId}]};
  if(sql.startsWith('SELECT id,platform,daily_cap FROM pod_accounts'))return {rows:[{id:accountId,platform:'redbubble',daily_cap:10}]};
  if(sql.startsWith('SELECT true AS present FROM pod_production_queue'))return {rows:[]};
  if(sql.startsWith('SELECT count(*)::int AS n FROM pod_quota_reservations'))return {rows:[{n:0}]};
  if(sql.startsWith('SELECT q.id,q.account_id,q.platform,q.manifest,q.qa_envelope,'))return {rows:[candidate]};
  if(sql.startsWith('UPDATE pod_production_queue')){mutations.push(['queue',args]);return queue;}
  if(sql.startsWith('INSERT INTO pod_quota_reservations')){mutations.push(['quota',args]);return quota;}
  if(sql.startsWith('UPDATE pod_accounts')){mutations.push(['account',args]);return account;}
  throw Error('UNEXPECTED_QUERY');
 }});
 return {db,mutations};
}

test('publish claim returns an exact data-only mutation snapshot',async()=>{
 const {db,mutations}=fixture();
 assert.deepEqual(await db.claimPublish(accountId,45),claimed);
 assert.deepEqual(mutations.map(([kind])=>kind),['queue','quota','account']);
});

test('publish claim rejects unverified queue transition evidence before quota mutation',async()=>{
 const attempts=[{rows:[claimed]}, {},
  {rowCount:0,rows:[claimed]},
  {rowCount:1,rows:[]},
  {rowCount:1,rows:[{...claimed,state:'qa_passed'}]},
  {rowCount:1,rows:[{...claimed,extra:true}]},
 ];
 for(const [index,queue] of attempts.entries()){
  const {db,mutations}=fixture({queue});
  await assert.rejects(db.claimPublish(accountId,45),/^Error: POD_MUTATION_UNVERIFIED$/,`queue ${index}`);
  assert.deepEqual(mutations.map(([kind])=>kind),['queue']);
 }
});

test('publish claim rejects unverified quota reservation and rolls back before cooldown',async()=>{
 const attempts=[{rows:[]}, {},
  {rowCount:0,rows:[]},
  {rowCount:1,rows:[{job_id:jobId,attempt:1,account_id:'other'}]},
  {rowCount:1,rows:[{job_id:jobId,attempt:1,account_id:accountId,extra:true}]},
 ];
 for(const [index,quota] of attempts.entries()){
  const {db,mutations}=fixture({quota});
  await assert.rejects(db.claimPublish(accountId,45),/^Error: POD_MUTATION_UNVERIFIED$/,`quota ${index}`);
  assert.deepEqual(mutations.map(([kind])=>kind),['queue','quota']);
 }
});

test('publish claim rejects unverified cooldown mutation so the transaction rolls back',async()=>{
 const attempts=[{rows:[]}, {},
  {rowCount:0,rows:[]},
  {rowCount:1,rows:[{id:'other'}]},
  {rowCount:1,rows:[{id:accountId,extra:true}]},
 ];
 for(const [index,account] of attempts.entries()){
  const {db,mutations}=fixture({account});
  await assert.rejects(db.claimPublish(accountId,45),/^Error: POD_MUTATION_UNVERIFIED$/,`account ${index}`);
  assert.deepEqual(mutations.map(([kind])=>kind),['queue','quota','account']);
 }
});
