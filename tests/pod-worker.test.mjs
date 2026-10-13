import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
test('disabled production never claims work',async()=>{
 assert.deepEqual(await produceOnce({env:{},db:{claimProduction(){throw Error('unexpected');}}}),{status:'DISABLED'});
});
test('production-only grant reaches task resolution without publishing',async()=>{
 const key='k'.repeat(48),brief={id:'j',account_id:'a',business_id:'b',platform:'kdp',destination_platform:'kdp',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'kdp',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 let resolved=false,failed=false;
 const result=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},upstreamKey:key,
  db:{claimProduction:async()=>({id:'j',brief}),failProduction:async()=>{failed=true;}},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:async()=>{resolved=true;return {rights_verified:false};}});
 assert.equal(resolved,true);assert.equal(failed,true);assert.equal(result.status,'BLOCKED');
});
