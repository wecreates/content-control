import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyEnvelope} from '../integrations/pod/policy.mjs';
const key='fixture-only-envelope-key'.repeat(2),audience='content-control:pod',now=1000;
const fields='"schema_version":1,"audience":"content-control:pod","issued_at_ms":1000,"expires_at_ms":2000';
const signed=payload=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')});
const verify=envelope=>verifyEnvelope(envelope,key,audience,now);
test('duplicate decoded signed fields cannot overwrite revocation, scope or nested QA',()=>{
 for(const extra of ['"revoked":true,"revoked":false','"job_id":"other","job_id":"job"',
  '"revoked":false,"revo\\u006bed":false','"checks":{"rights":false,"rights":true}',
  '"items":[{"verdict":"FAIL","verdict":"PASS"}]','"__proto__":{},"__proto__":{}']){
  assert.throws(()=>verify(signed('{'+fields+','+extra+'}')),/ENVELOPE_JSON_DUPLICATE_KEY/);
 }
});
test('signed numbers cannot become infinity or silently serialize as null',()=>{
 for(const number of ['1e400','-1e400','9'.repeat(400)]){
  assert.throws(()=>verify(signed('{'+fields+',"facts":[{"amount":'+number+'}]}')),/ENVELOPE_JSON_NONFINITE/);
 }
});
test('signed numbers must preserve exact identity through native serialization',()=>{
 for(const [number,error] of [
  ['9007199254740993',/ENVELOPE_JSON_UNSAFE_INTEGER/],
  ['-9007199254740993',/ENVELOPE_JSON_UNSAFE_INTEGER/],
  ['-0',/ENVELOPE_JSON_NONCANONICAL_NUMBER/],
  ['1.0',/ENVELOPE_JSON_NONCANONICAL_NUMBER/],
  ['1e0',/ENVELOPE_JSON_NONCANONICAL_NUMBER/],
  ['0.10000000000000001',/ENVELOPE_JSON_NONCANONICAL_NUMBER/],
  ['1e-400',/ENVELOPE_JSON_NONCANONICAL_NUMBER/],
 ]){
  assert.throws(()=>verify(signed('{'+fields+',"facts":[{"amount":'+number+'}]}')),error);
 }
});
test('signature must be an exact primitive lowercase hex string',()=>{
 const e=signed('{'+fields+'}');
 for(const signature of [[e.signature],new String(e.signature),{toString:()=>e.signature},null,0,true,
  e.signature+'\n',e.signature+'\r\n',e.signature.toUpperCase(),e.signature.slice(1)]){
  assert.throws(()=>verify({...e,signature}),/^Error: ENVELOPE_INVALID$/);
 }
});
test('signed envelope wrapper is an exact plain two-field JSON record',()=>{
 const valid=signed('{'+fields+'}'),wrappers=[];
 wrappers.push({...valid,private_token:'must-not-persist'});
 wrappers.push(Object.assign([],valid));
 wrappers.push(Object.assign(Object.create(null),valid));
 wrappers.push(Object.assign(new class Envelope {},valid));
 const symbolic={...valid};symbolic[Symbol('private')]='must-not-persist';wrappers.push(symbolic);
 const hidden={...valid};Object.defineProperty(hidden,'private_token',{value:'must-not-persist'});wrappers.push(hidden);
 let reads=0;const accessor={signature:valid.signature};
 Object.defineProperty(accessor,'payload',{enumerable:true,get(){reads++;return valid.payload;}});wrappers.push(accessor);
 for(const envelope of wrappers)assert.throws(()=>verify(envelope),/^Error: ENVELOPE_INVALID$/);
 assert.equal(reads,0,'reject accessors without invoking untrusted code');
 assert.deepEqual(verify(Object.freeze({...valid})),JSON.parse(valid.payload));
});
test('signed payload ceiling counts UTF-8 bytes with an inclusive exact boundary',()=>{
 const prefix='{'+fields+',"text":"',suffix='"}';
 const remaining=262144-Buffer.byteLength(prefix+suffix),fill='😀'.repeat(Math.floor(remaining/4))+'a'.repeat(remaining%4);
 const payload=prefix+fill+suffix;assert.equal(Buffer.byteLength(payload),262144);
 assert.equal(verify(signed(payload)).text,fill);
 const oversized=prefix+fill+'a'+suffix;assert.ok(oversized.length<262144);
 assert.throws(()=>verify(signed(oversized)),/^Error: ENVELOPE_INVALID$/);
});
test('signed envelope root must be an object rather than a primitive or array',()=>{
 for(const payload of ['null','[]','true','0','"text"']){
  assert.throws(()=>verify(signed(payload)),/^Error: ENVELOPE_EXPIRED_OR_INVALID$/);
 }
});
test('authentication precedes semantic JSON parsing and does not canonicalize payloads',()=>{
 for(const payload of ['{'+fields+',"revoked":true,"revoked":false}','{'+fields+',"amount":1e400}','not-json']){
  assert.throws(()=>verify({payload,signature:'0'.repeat(64)}),/^Error: SIGNATURE_INVALID$/);
 }
 const e=signed('{'+fields+'}');assert.throws(()=>verify({...e,payload:e.payload+' '}),/^Error: SIGNATURE_INVALID$/);
});
test('unambiguous JSON preserves Unicode, escaped text, arrays and separate object keys',()=>{
 const value={schema_version:1,audience,issued_at_ms:now,expires_at_ms:2000,
  text:'é e\u0301 😀 "quoted" \\ escaped',items:[{a:1},{a:2}],strings:['1e400','{"a":1,"a":2}'],
  finite:[-0,1e-300,1.25,Number.MIN_VALUE],empty:{},array:[]};
 const payload=JSON.stringify(value);assert.deepEqual(verify(signed(payload)),JSON.parse(payload));
 const deep='{'+fields+',"nested":'+'['.repeat(1000)+'0'+']'.repeat(1000)+'}';
 assert.ok(verify(signed(deep)).nested);
});
