import test from 'node:test';import assert from 'node:assert/strict';
import {initializeSocialService} from '../integrations/social-automation/hosted-service.mjs';
const env={SOCIAL_STORAGE_INITIALIZE:'true',SOCIAL_STORAGE_MODE:'postgres_encrypted',PUBLICATION_ENABLED:'false'};
function fixture(){const state={version:1,connections:{instagram:{marker:'existing'}},jobs:[{marker:'history'}]};const calls=[];const store={read:async()=>{calls.push('read');return state;},update:async fn=>{calls.push('update');return fn(state);},close:async()=>calls.push('close')};return {state,calls,store,postgresStoreFactory:()=>{calls.push('create');return store;},initializeVault:async s=>{assert.equal(s,store);calls.push('initialize');}};}
test('explicit bootstrap initializes and verifies read while leaving authorization and worker off',async()=>{
 const f=fixture(),before=structuredClone(f.state);const service=await initializeSocialService({env,...f});const s=service.status();assert.deepEqual(f.calls,['create','initialize','read','update','read','close']);assert.deepEqual(f.state.connections,before.connections);assert.deepEqual(f.state.jobs,before.jobs);assert.equal(s.storage_bootstrap.probe_id,f.state.storage_probe.id);assert.equal(s.storage_bootstrap.write_read_verified,true);assert.equal(s.storage_bootstrap.status,'INITIALIZED_READ_VERIFIED');assert.equal(s.durable_storage_verified,false);assert.equal(s.storage_bootstrap.durable_storage_verified,false);assert.equal(s.oauth_routes_enabled,false);assert.equal(s.worker_running,false);assert.equal(s.publication_enabled,false);await assert.rejects(service.beginAuthorization('instagram',{}),/NOT_CONFIGURED/);await service.stop();assert.equal(f.calls.filter(x=>x==='close').length,1);
});
test('bootstrap is opt-in and never falls back to another storage mode',async()=>{
 for(const settings of [{}, {...env,SOCIAL_STORAGE_INITIALIZE:'TRUE'}]){const f=fixture();await initializeSocialService({env:settings,...f});assert.deepEqual(f.calls,[]);}
 const f=fixture();const service=await initializeSocialService({env:{...env,SOCIAL_STORAGE_MODE:'private_durable'},...f});assert.equal(service.status().storage_bootstrap.status,'BLOCKED');assert.deepEqual(f.calls,[]);
});
test('initialization or read failure is sanitized, pool closes, no activation occurs',async()=>{
 for(const stage of ['initialize','read']){const f=fixture();if(stage==='initialize')f.initializeVault=async()=>{throw Error('SECRET_DATABASE_URI');};else f.store.read=async()=>{throw Error('PRIVATE_STORE_INTEGRITY_FAILED');};const service=await initializeSocialService({env,...f});const s=service.status();assert.equal(s.storage_bootstrap.status,'BLOCKED');assert.equal(s.oauth_routes_enabled,false);assert.equal(s.worker_running,false);assert.ok(!JSON.stringify(s).includes('SECRET_DATABASE_URI'));assert.equal(f.calls.at(-1),'close');}
});
test('publication policy prevents any bootstrap database access',async()=>{const f=fixture();const service=await initializeSocialService({env:{...env,PUBLICATION_ENABLED:'true'},...f});assert.deepEqual(f.calls,[]);assert.equal(service.status().reason_code,'PUBLICATION_POLICY_BLOCKED');});

test('existing probe is preserved across independent bootstrap calls without claiming durability',async()=>{
 const f=fixture();f.state.storage_probe={id:'12345678-1234-4234-8234-123456789abc',created_at:'2026-10-13T00:00:00.000Z'};const original=structuredClone(f.state.storage_probe);
 const bootIds=new Set();for(let i=0;i<2;i++){const service=await initializeSocialService({env,...f});bootIds.add(service.status().storage_bootstrap.runtime_boot_id);assert.equal(service.status().storage_bootstrap.probe_id,original.id);assert.equal(service.status().durable_storage_verified,false);assert.deepEqual(f.state.storage_probe,original);}
 assert.equal(bootIds.size,2);assert.ok(!JSON.stringify(f.state).includes('runtime_boot_id'));
});
test('invalid existing probe is never overwritten or reflected in status',async()=>{
 for(const probe of [null,{id:'SECRET_MARKER',created_at:'2026-10-13T00:00:00Z'},{id:'12345678-1234-4234-8234-123456789abc',created_at:'invalid'}]){const f=fixture();f.state.storage_probe=probe;const service=await initializeSocialService({env,...f});assert.deepEqual(f.state.storage_probe,probe);assert.equal(service.status().storage_bootstrap.status,'BLOCKED');assert.ok(!JSON.stringify(service.status()).includes('SECRET_MARKER'));}
});
test('probe must survive separate read before verification is reported',async()=>{
 const f=fixture();f.store.update=async fn=>fn(structuredClone(f.state));const service=await initializeSocialService({env,...f});assert.equal(service.status().storage_bootstrap.status,'BLOCKED');assert.equal(service.status().storage_bootstrap.read_verified,false);
});
