import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const qaKey='q'.repeat(48);
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
 JSON.stringify(value);
const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
 package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
  'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
const manifestSha256=crypto.createHash('sha256').update(canonical(manifest)).digest('hex');
const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-100,
 expires_at_ms:Date.now()+60000,verdict:'PASS',package_sha256:manifest.package_sha256,
 template_sha256:manifest.template_sha256,checks:Object.fromEntries(
  ['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance'].map(key=>[key,true]))});
const qaEnvelope={payload,signature:crypto.createHmac('sha256',qaKey).update(payload).digest('hex')};
const job={id:'job',account_id:'account',platform:'redbubble',fencing_token:'1',manifest,qa_envelope:qaEnvelope};
const current={id:job.id,platform:job.platform,manifest,qa_envelope:qaEnvelope,manifest_sha256:manifestSha256};

function fixture({currentResult={rows:[current]},leaseResult={rows:[{valid:true}]}}={}){
 const calls=[];
 const client={
  async query(query){
   const sql=typeof query==='string'?query:query.text;calls.push(sql);
   if(sql==='COMMIT')return {command:'COMMIT'};
   if(sql==='BEGIN'||sql==='ROLLBACK'||sql==='DISCARD ALL'||sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql.includes("q.state='publishing'")&&sql.includes('FOR SHARE OF q,p,a'))return currentResult;
   if(sql.startsWith('SELECT lease_until>clock_timestamp()'))return leaseResult;
   throw Error('UNEXPECTED_QUERY: '+sql);
  },
  release(){}
 };
 return {db:new PodDB({pool:{connect:async()=>client},bridge,qaKey,expiresAt:'2099-01-01T00:00:00Z'}),calls};
}

test('final publish guard rejects an accessor-backed durable snapshot result without invocation',async()=>{
 let reads=0;
 const result={};
 Object.defineProperty(result,'rows',{enumerable:true,get(){reads++;return [current];}});
 await assert.rejects(fixture({currentResult:result}).db.assertPublishable(job),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});

test('final publish guard rejects an accessor-backed lease result without invocation',async()=>{
 let reads=0;
 const result={};
 Object.defineProperty(result,'rows',{enumerable:true,get(){reads++;return [{valid:true}];}});
 await assert.rejects(fixture({leaseResult:result}).db.assertPublishable(job),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});

test('final publish guard accepts only exact inert durable snapshot query evidence',async()=>{
 let reads=0;
 const sparse=Array(1),extraRows=[current];extraRows.extra=true;
 const accessorRow={...current};
 Object.defineProperty(accessorRow,'manifest',{enumerable:true,get(){reads++;return manifest;}});
 const attempts=[
  new Proxy({rows:[current]},{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}}),
  {rows:new Proxy([current],{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})},
  {rows:sparse},
  {rows:extraRows},
  {rows:[current,current]},
  {rows:[new Proxy(current,{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})]},
  {rows:[accessorRow]},
  {rows:[{...current,extra:true}]},
  {rows:[{...current,id:'other'}]},
  {rows:[{...current,platform:'kdp'}]},
  {rows:[{...current,manifest_sha256:'bad'}]},
  {rows:[{...current,manifest:new Proxy(manifest,{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})}]},
  {rows:[{...current,qa_envelope:new Proxy(qaEnvelope,{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})}]},
 ];
 for(const currentResult of attempts)
  await assert.rejects(fixture({currentResult}).db.assertPublishable(job),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
 await assert.rejects(fixture({currentResult:{rows:[]}}).db.assertPublishable(job),/^Error: LOCAL_RELEASE_BLOCKED$/);
 await assert.rejects(fixture({currentResult:{rows:[{...current,manifest_sha256:'0'.repeat(64)}]}}).db.assertPublishable(job),/^Error: LOCAL_RELEASE_BLOCKED$/);
});

test('final publish guard accepts only exact inert lease query evidence',async()=>{
 let reads=0;
 const sparse=Array(1),extraRows=[{valid:true}];extraRows.extra=true;
 const accessorRow={};
 Object.defineProperty(accessorRow,'valid',{enumerable:true,get(){reads++;return true;}});
 const attempts=[
  new Proxy({rows:[{valid:true}]},{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}}),
  {rows:new Proxy([{valid:true}],{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})},
  {rows:sparse},
  {rows:extraRows},
  {rows:[{valid:true},{valid:true}]},
  {rows:[new Proxy({valid:true},{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})]},
  {rows:[accessorRow]},
  {rows:[{valid:true,extra:true}]},
 ];
 for(const leaseResult of attempts)
  await assert.rejects(fixture({leaseResult}).db.assertPublishable(job),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
 for(const leaseResult of [{rows:[]},{rows:[{valid:false}]},{rows:[{valid:null}]}])
  await assert.rejects(fixture({leaseResult}).db.assertPublishable(job),/^Error: LOCAL_RELEASE_BLOCKED$/);
 assert.equal(await fixture().db.assertPublishable(job),true);
});
