import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const qaKey='review-provenance-test-key-'.repeat(2);

function canonical(value){
 return Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
  value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
  JSON.stringify(value);
}

function reviewFixture(){
 const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
  package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
   'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-1,
  expires_at_ms:Date.now()+60000,verdict:'PASS',package_sha256:manifest.package_sha256,
  template_sha256:manifest.template_sha256,
  checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source',
   'text_provenance','template_provenance'].map(check=>[check,true]))});
 return {manifest,qa:{payload,signature:crypto.createHmac('sha256',qaKey).update(payload).digest('hex')},
  manifestSha256:crypto.createHash('sha256').update(canonical(manifest)).digest('hex')};
}

test('review retrieval selects manifest identity only from the review-hold event',async()=>{
 const queries=[];
 const client={release(){},query:async sql=>{queries.push(typeof sql==='string'?sql:sql.text);return {rows:[]};}};
 const pool={connect:async()=>client};
 const db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});

 await assert.rejects(db.reviewPackage('fixture-job'),/PACKAGE_UNAVAILABLE/);
 await assert.rejects(db.reviewArtifact('fixture-job','a'.repeat(64)),/ARTIFACT_UNAVAILABLE/);
 const retrievals=queries.filter(sql=>sql.includes("e.kind='pod.production.review_required'"));
 assert.equal(retrievals.length,2);
 for(const sql of retrievals)assert.match(sql,/e\.kind='pod\.production\.review_required'/);
});

test('review acceptance rejects a held package without its exact durable event identity',async()=>{
 const {manifest,qa,manifestSha256}=reviewFixture();
 for(const eventIdentity of [null,'f'.repeat(64)]){
  let writes=0;
  const db=new PodDB({pool:{},bridge,qaKey,expiresAt:'2099-01-01T00:00:00Z'});
  db.tx=fn=>fn({query:async sql=>{
   if(sql.startsWith('SELECT'))return {rows:[{id:'fixture-job',platform:'redbubble',state:'qa_failed',
    reason_code:'REVIEW_REQUIRED',manifest,manifest_sha256:eventIdentity}]};
   writes+=1;return {rows:[{id:'fixture-job'}]};
  }});
  assert.notEqual(eventIdentity,manifestSha256);
  await assert.rejects(db.acceptReview('fixture-job',qa),/PACKAGE_UNAVAILABLE/);
  assert.equal(writes,0);
 }
});
