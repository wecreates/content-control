import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyEnvelope} from '../integrations/pod/policy.mjs';

const key='fixture-only-clock-key-'.repeat(3),audience='content-control:pod';
function signed(issued=1000,expires=2000){
 const payload=JSON.stringify({schema_version:1,audience,issued_at_ms:issued,expires_at_ms:expires});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
}
for(const [name,now] of [['NaN',NaN],['null',null],['numeric string','1500'],['object',{}],
 ['coercible object',{valueOf:()=>1500}],['array',[1500]],['fraction',1500.5]]){
 test('envelope rejects invalid verifier clock: '+name,()=>{
  assert.throws(()=>verifyEnvelope(signed(),key,audience,now),/ENVELOPE_EXPIRED_OR_INVALID/);
 });
}
test('invalid default wall clock cannot accept expired evidence',t=>{
 t.mock.method(Date,'now',()=>NaN);
 assert.throws(()=>verifyEnvelope(signed(0,1),key,audience),/ENVELOPE_EXPIRED_OR_INVALID/);
});
for(const [name,issued,expires,now] of [
 ['fractional issuance',1000.5,2000,1500],['fractional expiry',1000,2000.5,1500],
 ['negative issuance',-1,2000,1500],['negative clock',-2,1,-1]]){
 test('envelope rejects invalid timestamp: '+name,()=>{
  assert.throws(()=>verifyEnvelope(signed(issued,expires),key,audience,now),/ENVELOPE_EXPIRED_OR_INVALID/);
 });
}
test('envelope rejects an unsafe timestamp before expiry arithmetic',()=>{
 assert.throws(()=>verifyEnvelope(signed(9007199254740992,9007199254740994),key,audience,9007199254740992),
  /ENVELOPE_JSON_UNSAFE_INTEGER/);
});
test('integer timestamp boundaries retain exact expiry and lifetime rules',()=>{
 for(const [issued,expires,now] of [[0,900000,0],[0,900000,899999],
  [Number.MAX_SAFE_INTEGER-900000,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER-1]]){
  assert.equal(verifyEnvelope(signed(issued,expires),key,audience,now).expires_at_ms,expires);
 }
 for(const [issued,expires,now] of [[1000,2000,999],[1000,2000,2000],[0,900001,1],[1000,1000,1000]]){
  assert.throws(()=>verifyEnvelope(signed(issued,expires),key,audience,now),/ENVELOPE_EXPIRED_OR_INVALID/);
 }
});
