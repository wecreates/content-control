import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const qaKey='q'.repeat(48);
const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
 package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
  'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:
 JSON.stringify(value);
const manifestSha256=crypto.createHash('sha256').update(canonical(manifest)).digest('hex');
const qaPayload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-100,
 expires_at_ms:Date.now()+60000,verdict:'PASS',package_sha256:manifest.package_sha256,
 template_sha256:manifest.template_sha256,checks:Object.fromEntries(
  ['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance'].map(key=>[key,true]))});
const qaEnvelope={payload:qaPayload,signature:crypto.createHmac('sha256',qaKey).update(qaPayload).digest('hex')};

function fixture(expireOn){
 const calls=[];
 let db;
 const client={
  async query(sql){
   sql=typeof sql==='string'?sql:sql.text;
   calls.push(sql);
   let rows=[];
   if(sql.startsWith('SELECT id FROM pod_accounts'))rows=[{id:'account'}];
   else if(sql.startsWith('SELECT * FROM pod_accounts'))rows=[{id:'account',platform:'redbubble',daily_cap:10}];
   else if(sql.startsWith('SELECT count(*)::int'))rows=[{n:0}];
   else if(sql.startsWith('SELECT q.*,'))rows=[{id:'job',platform:'redbubble',manifest,manifest_sha256:manifestSha256,qa_envelope:qaEnvelope}];
   else if(sql.startsWith('UPDATE pod_production_queue'))rows=[{id:'job',attempt:1}];
   if(sql.includes(expireOn))db.expiresAt=0;
   return {rows};
  },
  release(){}
 };
 db=new PodDB({pool:{connect:async()=>client},bridge,qaKey,expiresAt:'2099-01-01T00:00:00Z'});
 return {db,calls};
}

for(const [name,expireOn,forbidden] of [
 ['account lock','SELECT id FROM pod_accounts','SELECT * FROM pod_accounts'],
 ['queue lock','SELECT q.*,','UPDATE pod_production_queue'],
 ['publishing transition','UPDATE pod_production_queue','INSERT INTO pod_quota_reservations'],
 ['quota reservation','INSERT INTO pod_quota_reservations','UPDATE pod_accounts SET next_allowed_at']
])test(`publish claim stops after storage expires during ${name}`,async()=>{
 const {db,calls}=fixture(expireOn);
 await assert.rejects(db.claimPublish('account',45),/POD_STORAGE_EXPIRING/);
 assert.equal(calls.some(sql=>sql.includes(forbidden)),false);
});
