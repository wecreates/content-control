import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',
 contract:{fail_closed_rules:BRIDGE_RULES}};
const qaKey='durable-manifest-admission-key-'.repeat(2);
const job={id:'manifest-admission-job',fencing_token:1,platform:'redbubble'};
const checks=Object.fromEntries([
 'text','geometry','resolution','rights','competitive','print_preflight',
 'original_source','text_provenance','template_provenance',
].map(name=>[name,true]));

function signQA(manifest){
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',
  issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,verdict:'PASS',
  package_sha256:manifest.package_sha256,template_sha256:manifest.template_sha256,checks});
 return {payload,signature:crypto.createHmac('sha256',qaKey).update(payload).digest('hex')};
}

function malformedManifests(){
 const base={schema_version:1,platform:'redbubble',publication_enabled:false,
  package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
   'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
 const missingTemplate={...base};
 delete missingTemplate.template_sha256;
 return [
  missingTemplate,
  {...base,publication_enabled:true},
  {...base,platform:'teepublic'},
  {...base,files:{...base.files,'undeclared.png':'f'.repeat(64)}},
 ];
}

function unsupportedManifest(){
 const manifest={...malformedManifests()[0],platform:'etsy',publication_enabled:false};
 return {job:{...job,platform:'etsy'},manifest};
}

function fixture(){
 let queries=0;
 const db=new PodDB({pool:{},bridge,qaKey,expiresAt:'2099-01-01T00:00:00Z'});
 db.tx=fn=>fn({query:async()=>{
  queries+=1;
  return {rows:[{id:job.id,valid:true,rights_state:'PASS',permanently_unpublished:false}]};
 }});
 return {db,queries:()=>queries};
}

test('durable review holds reject malformed package manifests before database access',async()=>{
 for(const manifest of malformedManifests()){
  const {db,queries}=fixture();
  await assert.rejects(db.holdProduction(job,manifest),/PACKAGE_UNAVAILABLE/);
  assert.equal(queries(),0);
 }
 const unsupported=unsupportedManifest(),{db,queries}=fixture();
 await assert.rejects(db.holdProduction(unsupported.job,unsupported.manifest),/PACKAGE_UNAVAILABLE/);
 assert.equal(queries(),0);
});

test('durable QA completion rejects malformed package manifests before database access',async()=>{
 for(const manifest of malformedManifests()){
  const {db,queries}=fixture();
  await assert.rejects(db.completeProduction(job,manifest,signQA(manifest)),/PACKAGE_UNAVAILABLE/);
  assert.equal(queries(),0);
 }
 const unsupported=unsupportedManifest(),{db,queries}=fixture();
 await assert.rejects(db.completeProduction(unsupported.job,unsupported.manifest,signQA(unsupported.manifest)),/PACKAGE_UNAVAILABLE/);
 assert.equal(queries(),0);
});
