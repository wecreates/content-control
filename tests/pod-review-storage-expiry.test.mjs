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
 const pool={query:async()=>{
  db.expiresAt=Date.now();
  return {rows:[{id:'fixture-job',platform:'redbubble',state:'qa_failed',reason_code:'REVIEW_REQUIRED',manifest,
   manifest_sha256:crypto.createHash('sha256').update(canonical(manifest)).digest('hex')}]};
 }};
 db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.reviewPackage('fixture-job'),/POD_STORAGE_EXPIRING/);
});
