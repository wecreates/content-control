import test from 'node:test';
import assert from 'node:assert/strict';
import {requirePodRuntime} from '../integrations/pod/runtime-gate.mjs';
const env={POD_UPSTREAM_KEY:'u'.repeat(32),POD_QA_KEY:'q'.repeat(32),INTERNAL_OPERATIONS_KEY:'o'.repeat(32)};
const codes=['POD_UPSTREAM_KEY','POD_QA_KEY','INTERNAL_OPERATIONS_KEY','POD_KEY_ISOLATION','PUBLICATION_DISABLED','STORAGE_LIFETIME','BRIDGE_CONTRACT','DEDICATED_DATABASE_CONFIGURED','RESTRICTED_RUNTIME_ROLE','DATABASE_TLS','POD_TABLE_PRIVILEGES','SOCIAL_VAULT_ISOLATED','SCHEMA_CHECKSUMS','DATABASE_READABLE'];
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

test('configured evidence and transport keys cannot share any runtime authority',async()=>{
 for(const name of ['POD_INTAKE_KEY','POD_FINANCE_KEY','POD_MARKET_KEY','POD_PROVIDER_KEY',
  'POD_REGISTRY_KEY','POD_RIGHTS_KEY','POD_TEMPLATE_KEY','POD_REVIEW_KEY','POD_SOURCE_KEY',
  'POD_EDITORIAL_KEY','POD_GRANT_AUTH_KEY','POD_OUTBOX_KEY']){
  for(const value of [env.POD_QA_KEY,'short',42])await assert.rejects(requirePodRuntime({pool:{},
   env:{...env,[name]:value},check:()=>assert.fail('invalid keys must block before database checks')}),/POD_RUNTIME_KEYS_INVALID/);
 }
 await assert.rejects(requirePodRuntime({pool:{},env:{...env,POD_FINANCE_KEY:'f'.repeat(32),
  POD_MARKET_KEY:'f'.repeat(32)},check:()=>assert.fail('optional scopes must also be isolated')}),/POD_RUNTIME_KEYS_INVALID/);
});

test('isolation compares the UTF-8 bytes actually used by HMAC',async()=>{
 await assert.rejects(requirePodRuntime({pool:{},env:{...env,POD_QA_KEY:'q'.repeat(32)+'\ud800',
  POD_EDITORIAL_KEY:'q'.repeat(32)+'\ud801'},check:()=>assert.fail('equal key bytes must block')}),/POD_RUNTIME_KEYS_INVALID/);
});

test('distinct optional credentials and absent disabled-lane credentials pass',async()=>{
 const optional={POD_INTAKE_KEY:'i'.repeat(32),POD_FINANCE_KEY:'f'.repeat(32),POD_MARKET_KEY:'m'.repeat(32),
  POD_PROVIDER_KEY:'p'.repeat(32),POD_REGISTRY_KEY:'r'.repeat(32),POD_RIGHTS_KEY:'s'.repeat(32),
  POD_TEMPLATE_KEY:'t'.repeat(32),POD_REVIEW_KEY:'v'.repeat(32),POD_SOURCE_KEY:'c'.repeat(32),
  POD_EDITORIAL_KEY:'e'.repeat(32),POD_GRANT_AUTH_KEY:'g'.repeat(32),POD_OUTBOX_KEY:'b'.repeat(32)};
 for(const extra of [optional,{POD_INTAKE_KEY:'',POD_EDITORIAL_KEY:undefined}])
  assert.equal(await requirePodRuntime({pool:{},env:{...env,...extra},check:async()=>report()}),true);
});
