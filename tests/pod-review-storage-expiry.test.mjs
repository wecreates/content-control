import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
 JSON.stringify(value);

test('review package rechecks storage lifetime after its database wait',async()=>{
 const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,package_sha256:'a'.repeat(64),
  files:{'art-mask.png':'b'.repeat(64),'print.png':'c'.repeat(64),'text-mask.png':'d'.repeat(64)}};
 let db;
 const client={release(){},query:async()=>{
  db.expiresAt=Date.now();
  return {rows:[{id:'fixture-job',platform:'redbubble',state:'qa_failed',reason_code:'REVIEW_REQUIRED',manifest,
   manifest_sha256:crypto.createHash('sha256').update(canonical(manifest)).digest('hex')}]};
 }};const pool={connect:async()=>client};
 db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.reviewPackage('fixture-job'),/POD_STORAGE_EXPIRING/);
});

const validPng=()=>{
 const body=Buffer.alloc(45);
 Buffer.from('89504e470d0a1a0a','hex').copy(body);
 body.writeUInt32BE(13,8);body.write('IHDR',12,'ascii');
 body.writeUInt32BE(0,33);body.write('IEND',37,'ascii');
 return body;
};

for(const [name,read] of [
 ['review package',(db)=>db.reviewPackage('fixture-job')],
 ['review artifact',(db,sha)=>db.reviewArtifact('fixture-job',sha)]
]){
 test(name+' rechecks storage lifetime after stored manifest validation',async()=>{
  const body=validPng(),sha=crypto.createHash('sha256').update(body).digest('hex');
  const plain={schema_version:1,platform:'redbubble',publication_enabled:false,package_sha256:'a'.repeat(64),
   files:{'art-mask.png':'b'.repeat(64),'print.png':sha,'text-mask.png':'d'.repeat(64)}};
  const manifestSha256=crypto.createHash('sha256').update(canonical(plain)).digest('hex');
  let db;
  const manifest=new Proxy(plain,{get(target,key,receiver){
   if(key==='files')db.expiresAt=Date.now();
   return Reflect.get(target,key,receiver);
  }});
  const client={release(){},query:async()=>({rows:[{id:'fixture-job',platform:'redbubble',state:'qa_failed',
   reason_code:'REVIEW_REQUIRED',manifest,manifest_sha256:manifestSha256,body,media_type:'image/png'}]})};
  const pool={connect:async()=>client};
  db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
  await assert.rejects(read(db,sha),/POD_STORAGE_EXPIRING/);
 });
}
