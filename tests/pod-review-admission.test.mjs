import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-review-admission-key-'.repeat(2);
const jobId='fixture-job';

function signed(){
 const now=Date.now();
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:now-1,
  expires_at_ms:now+60000,verdict:'PASS',package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),checks:{}});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
}

function fixture(){
 let txCalls=0,poolQueries=0;
 const client={release(){},query:async()=>{poolQueries+=1;return {rows:[]};}};
 const pool={connect:async()=>client};
 const db=new PodDB({pool,bridge,qaKey:key,expiresAt:'2099-01-01T00:00:00Z'});
 db.tx=async()=>{txCalls+=1;throw Error('UNEXPECTED_DATABASE_ACCESS');};
 return {db,txCalls:()=>txCalls,poolQueries:()=>poolQueries};
}

const invalid=[undefined,null,1,{},'', '   ', 'x'.repeat(101), 'bad.job', 'bad\0job', 'révision'];

for(const requestedId of invalid){
 test('invalid signed-review target fails before transaction access: '+String(requestedId),async()=>{
  const {db,txCalls}=fixture();
  await assert.rejects(db.acceptReview(requestedId,signed()),/REVIEW_NOT_PENDING/);
  assert.equal(txCalls(),0);
 });

 test('invalid package target fails before pool access: '+String(requestedId),async()=>{
  const {db,poolQueries}=fixture();
  await assert.rejects(db.reviewPackage(requestedId),/PACKAGE_UNAVAILABLE/);
  assert.equal(poolQueries(),0);
 });
}

test('review authentication remains ahead of target validation',async()=>{
 const {db,txCalls}=fixture();
 const envelope=signed();envelope.signature='0'.repeat(64);
 await assert.rejects(db.acceptReview(null,envelope),/SIGNATURE_INVALID/);
 assert.equal(txCalls(),0);
});

test('an exact safe review target reaches each database boundary unchanged',async()=>{
 const accepted=fixture();
 await assert.rejects(accepted.db.acceptReview(jobId,signed()),/UNEXPECTED_DATABASE_ACCESS/);
 assert.equal(accepted.txCalls(),1);

 const packaged=fixture();
 await assert.rejects(packaged.db.reviewPackage(jobId),/PACKAGE_UNAVAILABLE/);
 assert.equal(packaged.poolQueries(),4);
});
