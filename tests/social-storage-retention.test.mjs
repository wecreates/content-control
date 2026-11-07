import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {parseStorageRetention} from '../integrations/social-automation/storage-retention.mjs';
import {PostgresSocialStore,createPostgresStore,postgresPoolOptions,initializePostgresVault} from '../integrations/social-automation/postgres-store.mjs';
import {socialRuntimeReadiness} from '../social-automation.js';
import {initializeSocialService} from '../integrations/social-automation/hosted-service.mjs';

const key='d'.repeat(64), deadline='2030-01-03T00:00:00Z', expiry=Date.parse(deadline);
const neonEnv={SOCIAL_STORAGE_MODE:'postgres_encrypted',SOCIAL_STORAGE_RETENTION_POLICY:'no_fixed_expiry',SOCIAL_VAULT_KEY:key,SOCIAL_DATABASE_URL:'postgresql://owner:dummy@ep-fixture.neon.tech/vault?sslmode=verify-full',PUBLICATION_ENABLED:'false'};
const empty={version:1,connections:{},jobs:[]};

test('retention policy is explicit; missing, unknown and conflicting policies fail closed',()=>{
 for(const retentionPolicy of [undefined,''])assert.throws(()=>parseStorageRetention({retentionPolicy,expiresAt:deadline}),/^Error: STORAGE_RETENTION_POLICY_REQUIRED$/);
 for(const retentionPolicy of [null,false,{},'NO_FIXED_EXPIRY','no_fixed_expiry ','unlimited'])assert.throws(()=>parseStorageRetention({retentionPolicy}),/^Error: STORAGE_RETENTION_POLICY_INVALID$/);
 for(const expiresAt of [undefined,null,'','invalid',Infinity,123])assert.throws(()=>parseStorageRetention({retentionPolicy:'fixed_expiry',expiresAt}),/^Error: STORAGE_EXPIRY_REQUIRED$/);
 for(const expiresAt of [deadline,'invalid','',null])assert.throws(()=>parseStorageRetention({retentionPolicy:'no_fixed_expiry',expiresAt}),/^Error: STORAGE_RETENTION_POLICY_CONFLICT$/);
 assert.deepEqual(parseStorageRetention({retentionPolicy:'fixed_expiry',expiresAt:deadline}),{retentionPolicy:'fixed_expiry',expiry});
 assert.deepEqual(parseStorageRetention({retentionPolicy:'no_fixed_expiry'}),{retentionPolicy:'no_fixed_expiry',expiry:null});
});

test('fixed deadline rejects reads and writes at exact 24-hour boundary without database work',async()=>{
 for(const now of [expiry-86400000,expiry-1,expiry,expiry+1]){
  let calls=0;const pool={query:()=>{calls++;},connect:()=>{calls++;}};
  const store=new PostgresSocialStore({pool,key,retentionPolicy:'fixed_expiry',expiresAt:deadline,now:()=>now});
  await assert.rejects(store.read(),/^Error: STORAGE_EXPIRING$/);
  await assert.rejects(store.update(()=>assert.fail('callback must not run')),/^Error: STORAGE_EXPIRING$/);
  assert.equal(calls,0);
 }
 const store=new PostgresSocialStore({pool:{},key,retentionPolicy:'fixed_expiry',expiresAt:deadline,now:()=>expiry-86400001});
 assert.doesNotThrow(()=>store.active());
});

test('fixed expiry crossing during a transaction rolls back instead of committing a replacement',async()=>{
 let clock=expiry-86400001,store;const commands=[];
 const client={query:async(sql)=>{commands.push(sql);return {rows:sql.includes('FOR UPDATE')?[{envelope:store.seal(empty)}]:[]};},release:()=>commands.push('release')};
 store=new PostgresSocialStore({pool:{connect:async()=>client},key,retentionPolicy:'fixed_expiry',expiresAt:deadline,now:()=>clock});
 await assert.rejects(store.update(d=>{d.marker='uncommitted';clock++;}),/^Error: STORAGE_EXPIRING$/);
 assert.ok(commands.includes('ROLLBACK'));assert.ok(!commands.some(x=>x.startsWith('UPDATE')));assert.ok(!commands.includes('COMMIT'));assert.equal(commands.at(-1),'release');
});

test('non-fixed-expiry store preserves encryption and transaction semantics without inventing a deadline',async()=>{
 let store,envelope;const commands=[];
 const query=async(sql,args)=>{commands.push(sql);if(sql.startsWith('SELECT'))return {rows:[{envelope}]};if(sql.startsWith('UPDATE'))envelope=args[0];return {rows:[]};};
 const client={query,release:()=>commands.push('release')};
 store=new PostgresSocialStore({pool:{query,connect:async()=>client,end:async()=>{}},key,retentionPolicy:'no_fixed_expiry',now:()=>Date.parse('2099-01-01T00:00:00Z')});
 envelope=store.seal(empty);assert.equal(store.expiry,null);assert.deepEqual(await store.read(),empty);
 await store.update(d=>{d.marker='synthetic-private-marker';});assert.equal((await store.read()).marker,'synthetic-private-marker');assert.ok(!JSON.stringify(envelope).includes('synthetic-private-marker'));assert.ok(commands.includes('COMMIT'));
 await initializePostgresVault(store);assert.equal((await store.read()).marker,'synthetic-private-marker');
 await store.close();await assert.rejects(store.read(),/^Error: PRIVATE_STORE_UNAVAILABLE$/);
});

test('pool factory validates policy before construction, and passes exact no-deadline policy with verified TLS',async()=>{
 const OriginalPool=pg.Pool;const pools=[];
 pg.Pool=class {constructor(options){this.options=options;pools.push(this);}on(){}async end(){this.ended=true;}};
 try{
  for(const settings of [
   {...neonEnv,SOCIAL_STORAGE_RETENTION_POLICY:undefined},
   {...neonEnv,SOCIAL_STORAGE_RETENTION_POLICY:'invalid'},
   {...neonEnv,SOCIAL_STORAGE_EXPIRES_AT:deadline},
   {...neonEnv,SOCIAL_STORAGE_RETENTION_POLICY:'fixed_expiry'},
  ])assert.throws(()=>createPostgresStore(settings),/STORAGE_/);
  assert.equal(pools.length,0);
  const store=createPostgresStore(neonEnv);assert.equal(store.retentionPolicy,'no_fixed_expiry');assert.equal(store.expiry,null);assert.deepEqual(pools[0].options.ssl,{rejectUnauthorized:true});assert.equal(pools[0].options.connectionString,undefined);
  await store.close();assert.equal(pools[0].ended,true);
 }finally{pg.Pool=OriginalPool;}
});

test('readiness distinguishes valid no-deadline from missing, malformed and conflicting policy',()=>{
 const ready=socialRuntimeReadiness(neonEnv);assert.deepEqual(ready.missing_configuration,[]);assert.equal(ready.storage_retention_policy,'no_fixed_expiry');assert.equal(ready.storage_policy_reason_code,null);assert.equal(ready.publication_enabled,false);
 const missing=socialRuntimeReadiness({...neonEnv,SOCIAL_STORAGE_RETENTION_POLICY:undefined});assert.ok(missing.missing_configuration.includes('SOCIAL_STORAGE_RETENTION_POLICY'));assert.equal(missing.storage_policy_reason_code,'STORAGE_RETENTION_POLICY_REQUIRED');
 const fixed=socialRuntimeReadiness({...neonEnv,SOCIAL_STORAGE_RETENTION_POLICY:'fixed_expiry'});assert.ok(fixed.missing_configuration.includes('SOCIAL_STORAGE_EXPIRES_AT'));assert.equal(fixed.storage_policy_reason_code,'STORAGE_EXPIRY_REQUIRED');
 const conflict=socialRuntimeReadiness({...neonEnv,SOCIAL_STORAGE_EXPIRES_AT:deadline});assert.equal(conflict.storage_retention_policy,null);assert.equal(conflict.storage_policy_reason_code,'STORAGE_RETENTION_POLICY_CONFLICT');
});

function fixture(){
 const calls=[],state={...structuredClone(empty),storage_probe:{id:'12345678-1234-4234-8234-123456789abc',created_at:'2026-10-13T00:00:00.000Z'}};
 return {calls,state,postgresStoreFactory:()=>{calls.push('create');return {read:async()=>{calls.push('read');return state;},update:async()=>assert.fail('read check must not write'),close:async()=>calls.push('close')};},initializeVault:async()=>assert.fail('read check must not initialize')};
}
test('no-fixed-expiry hosted read check reports null expiry and dated evidence only, with publication off',async()=>{
 const f=fixture();let now=Date.parse('2026-10-26T00:00:00Z');
 const service=await initializeSocialService({env:{...neonEnv,SOCIAL_STORAGE_CHECK_ENABLED:'true'},now:()=>now,...f});
 const first=service.status();assert.deepEqual(f.calls,['create','read','close']);assert.equal(first.storage_retention_policy,'no_fixed_expiry');assert.equal(first.storage_expires_at,null);assert.equal(first.storage_health.status,'STARTUP_OBSERVATION_ONLY');assert.equal(first.storage_health.operations_blocked,false);
 const calls=[...f.calls];now=Date.parse('2099-01-01T00:00:00Z');const later=service.status();
 assert.equal(later.storage_expires_at,null);assert.equal(later.storage_health.operations_blocked,false);assert.equal(later.storage_health.live_database_checked,false);assert.equal(later.storage_health.availability_verified,false);assert.equal(later.durable_storage_verified,false);assert.deepEqual(later.storage_bootstrap,first.storage_bootstrap);assert.deepEqual(f.calls,calls);
 assert.equal(later.publication_enabled,false);assert.equal(later.external_writes_enabled,false);assert.equal(later.oauth_routes_enabled,false);assert.equal(later.worker_running,false);
 await service.stop();assert.equal(service.status().storage_health.status,'STOPPED');assert.equal(service.status().storage_health.operations_blocked,true);
});

test('hosted invalid policies stop before even injected database factories and never reflect configuration values',async()=>{
 for(const settings of [
  {SOCIAL_STORAGE_RETENTION_POLICY:undefined},
  {SOCIAL_STORAGE_RETENTION_POLICY:'SECRET_POLICY_MARKER'},
  {SOCIAL_STORAGE_EXPIRES_AT:'SECRET_EXPIRY_MARKER'},
  {SOCIAL_STORAGE_RETENTION_POLICY:'fixed_expiry',SOCIAL_STORAGE_EXPIRES_AT:'SECRET_EXPIRY_MARKER'},
 ]){
  const f=fixture();const service=await initializeSocialService({env:{...neonEnv,...settings,SOCIAL_STORAGE_CHECK_ENABLED:'true'},...f});const status=service.status();
  assert.deepEqual(f.calls,[]);assert.equal(status.status,'ACTIVATION_BLOCKED');assert.equal(status.storage_health.operations_blocked,true);assert.equal(status.storage_bootstrap.read_verified,false);assert.equal(status.publication_enabled,false);assert.ok(!JSON.stringify(status).includes('SECRET_'));
 }
 const f=fixture();const disabled=await initializeSocialService({env:{...neonEnv,SOCIAL_STORAGE_RETENTION_POLICY:undefined},...f});assert.deepEqual(f.calls,[]);assert.equal(disabled.status().storage_health.status,'CONFIGURATION_REQUIRED');assert.equal(disabled.status().storage_health.reason_code,'STORAGE_RETENTION_POLICY_REQUIRED');
});

test('non-fixed-expiry policy does not bypass the publication lock',async()=>{
 const f=fixture();const service=await initializeSocialService({env:{...neonEnv,SOCIAL_STORAGE_CHECK_ENABLED:'true',PUBLICATION_ENABLED:'true'},...f});assert.deepEqual(f.calls,[]);assert.equal(service.status().reason_code,'PUBLICATION_POLICY_BLOCKED');assert.equal(service.status().publication_enabled,false);
});

test('URL security rejects duplicate, malformed or override parameters and explicitly rejects unsupported binding',()=>{
 const root='postgresql://owner:dummy@ep-fixture.neon.tech/vault';
 for(const suffix of [
  '?sslmode=require&sslmode=disable','?sslmode=require&sslmode=require','?channel_binding=require&channel_binding=disable',
  '?channel_binding=invalid','?channel_binding=','?sslmode=prefer','?sslmode=','?ssl=false','?rejectUnauthorized=false','?sslrootcert=private','?options=private','?SSLMode=require',
 ])assert.throws(()=>postgresPoolOptions(root+suffix),/^Error: PRIVATE_STORE_CONFIGURATION_REQUIRED$/);
 for(const value of ['require','prefer','disable'])assert.throws(()=>postgresPoolOptions(root+'?sslmode=require&channel_binding='+value),/^Error: PRIVATE_STORE_CHANNEL_BINDING_UNSUPPORTED$/);
 for(const url of ['postgres://%ZZ:dummy@host/vault','postgres://owner:%ZZ@host/vault','postgres://owner:dummy@host/%ZZ'])assert.throws(()=>postgresPoolOptions(url),/^Error: PRIVATE_STORE_CONFIGURATION_REQUIRED$/);
 for(const suffix of ['', '?sslmode=require','?sslmode=verify-full']){const options=postgresPoolOptions(root+suffix);assert.deepEqual(options.ssl,{rejectUnauthorized:true});assert.equal(options.connectionString,undefined);assert.equal(options.host,'ep-fixture.neon.tech');}
});

test('hosted unsupported channel-binding error is sanitized and never reported as a verified store',async()=>{
 const service=await initializeSocialService({env:{...neonEnv,SOCIAL_STORAGE_CHECK_ENABLED:'true',SOCIAL_DATABASE_URL:neonEnv.SOCIAL_DATABASE_URL+'&channel_binding=require'}});
 const status=service.status();assert.equal(status.reason_code,'PRIVATE_STORE_CHANNEL_BINDING_UNSUPPORTED');assert.equal(status.storage_health.operations_blocked,true);assert.equal(status.storage_bootstrap.read_verified,false);assert.ok(!JSON.stringify(status).includes('ep-fixture.neon.tech'));assert.equal(status.publication_enabled,false);
});
