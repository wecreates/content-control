import test from 'node:test';
import assert from 'node:assert/strict';
import {requirePodRuntime} from '../integrations/pod/runtime-gate.mjs';
const env={POD_UPSTREAM_KEY:'u'.repeat(32),POD_QA_KEY:'q'.repeat(32),INTERNAL_OPERATIONS_KEY:'o'.repeat(32)};
const codes=['POD_UPSTREAM_KEY','POD_QA_KEY','INTERNAL_OPERATIONS_KEY','PUBLICATION_DISABLED','STORAGE_LIFETIME','BRIDGE_CONTRACT','DEDICATED_DATABASE_CONFIGURED','RESTRICTED_RUNTIME_ROLE','DATABASE_TLS','POD_TABLE_PRIVILEGES','SOCIAL_VAULT_ISOLATED','SCHEMA_CHECKSUMS','DATABASE_READABLE'];
const report=()=>({status:'CONFIGURATION_VERIFIED',checks:codes.map(code=>({code,status:'PASS'}))});
test('runtime rejects weak and shared authority keys before database checks',async()=>{
 for(const values of [{...env,POD_QA_KEY:''},{...env,POD_QA_KEY:env.POD_UPSTREAM_KEY}])await assert.rejects(requirePodRuntime({pool:{},env:values,check:()=>assert.fail('unexpected check')}),/KEYS_INVALID/);
});
test('every required check independently blocks startup',async()=>{
 for(const code of codes){const r=report();r.checks.find(c=>c.code===code).status='BLOCKED';
  await assert.rejects(requirePodRuntime({pool:{},env,check:async()=>r}),/PREFLIGHT_BLOCKED/);
 }
});
test('missing or duplicated check evidence cannot pass',async()=>{
 for(const checks of [[],report().checks.slice(1),[...report().checks,report().checks[0]]])await assert.rejects(requirePodRuntime({pool:{},env,check:async()=>({status:'CONFIGURATION_VERIFIED',checks})}),/PREFLIGHT_BLOCKED/);
});
test('gate borrows the pool without closing it',async()=>{
 let connected=false,closed=false;
 const pool={connect:async()=>{connected=true;return 'client';},end:async()=>{closed=true;}};
 assert.equal(await requirePodRuntime({pool,env,check:async({connect})=>{const wrapper=await connect();assert.equal(await wrapper.connect(),'client');await wrapper.end();return report();}}),true);
 assert.equal(connected,true);assert.equal(closed,false);
});
