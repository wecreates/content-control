import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {preflight} from '../scripts/pod_preflight.mjs';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const env={POD_DATABASE_URL:'postgresql://secret:secret@example.invalid/db',POD_BRIDGE_PATH:'bridge',
 POD_UPSTREAM_KEY:'a'.repeat(32),POD_QA_KEY:'b'.repeat(32),INTERNAL_OPERATIONS_KEY:'c'.repeat(32),
 POD_STORAGE_EXPIRES_AT:'2030-01-01',PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'};
function fixture(overrides={}){
 const queries=[];let released=false,ended=false;
 const client={async query(sql,args){queries.push(sql);
  if(overrides.throwOn&&sql.includes(overrides.throwOn))throw Error('secret password internal-url');
  if(sql.includes('FROM pg_roles r'))return {rows:[{rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,db_create:false,elevated_membership:false,schema_create:false,...overrides.role}]};
  if(sql.includes('pg_stat_ssl'))return {rows:[{ssl:overrides.tls??true}]};
  if(sql.includes('ANY($1'))return {rows:args[0].map(relname=>({relname,owns:false,excess:false,can_select:true,can_insert:relname!=='pod_schema_version',can_update:relname!=='pod_schema_version'}))};
  if(sql.includes("relname='cyzor_social_vault'"))return {rows:[{access:overrides.vault??false,column_access:false,owns:false}]};
  if(sql.includes('SELECT version,sha256'))return {rows:['001_pod.sql','002_pod.sql','003_pod.sql','004_pod.sql','005_pod.sql'].filter(v=>v!==overrides.missingMigration).map(version=>({version,sha256:overrides.hash??crypto.createHash('sha256').update('sql').digest('hex')}))};
  return {rows:[]};},release(){released=true;}};
 return {options:{env,now:0,readFile:async p=>p==='bridge'?JSON.stringify(bridge):'sql',connect:async()=>({connect:async()=>client,end:async()=>{ended=true;}})},queries,closed:()=>released&&ended};
}
test('verified configuration is read-only and never authorizes publication',async()=>{
 const f=fixture(),r=await preflight(f.options);assert.equal(r.status,'CONFIGURATION_VERIFIED');assert.equal(r.publication_enabled,false);
 assert.equal(f.queries[0],'BEGIN READ ONLY');assert.equal(f.queries.at(-1),'ROLLBACK');assert.ok(f.closed());
 assert.ok(f.queries.every(q=>/^(SELECT|BEGIN READ ONLY|SET LOCAL|ROLLBACK)/.test(q)));
});
test('invalid artifact budget blocks preflight without exposing its value',async()=>{
 const f=fixture(),r=await preflight({...f.options,env:{...env,POD_ARTIFACT_BUDGET_BYTES:'private-invalid-budget'}});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.checks.find(c=>c.code==='ARTIFACT_STORAGE_BUDGET').status,'BLOCKED');
 assert.equal(JSON.stringify(r).includes('private-invalid-budget'),false);
});
test('missing configuration blocks without attempting a database connection',async()=>{
 const r=await preflight({env:{},readFile:async()=>{throw Error('missing');},connect:()=>{assert.fail('must not connect');}});
 assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code==='DEDICATED_DATABASE_CONFIGURED').status,'BLOCKED');
});
for(const [name,overrides,code] of [['privileged role',{role:{elevated_membership:true}},'RESTRICTED_RUNTIME_ROLE'],['TLS absent',{tls:false},'DATABASE_TLS'],['vault access',{vault:true},'SOCIAL_VAULT_ISOLATED'],['modified migration',{hash:'bad'},'SCHEMA_CHECKSUMS']]){
 test(name+' fails closed',async()=>{const f=fixture(overrides),r=await preflight(f.options);assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code===code).status,'BLOCKED');assert.ok(f.closed());});
}
test('database errors redact details and always release connection',async()=>{
 const f=fixture({throwOn:'pg_roles'}),r=await preflight(f.options);assert.equal(r.status,'BLOCKED');assert.ok(!JSON.stringify(r).includes('secret'));assert.ok(f.closed());assert.equal(f.queries.at(-1),'ROLLBACK');
});
test('expiry and enabled publishing block deployment preflight',async()=>{
 const f=fixture(),r=await preflight({...f.options,env:{...env,POD_STORAGE_EXPIRES_AT:'invalid',PUBLICATION_ENABLED:'true'}});
 for(const code of ['STORAGE_LIFETIME','PUBLICATION_DISABLED'])assert.equal(r.checks.find(c=>c.code===code).status,'BLOCKED');
});
test('missing market evidence migration blocks preflight',async()=>{
 const f=fixture({missingMigration:'003_pod.sql'}),r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code==='SCHEMA_CHECKSUMS').status,'BLOCKED');
});
test('missing financial uniqueness migration blocks preflight',async()=>{
 const f=fixture({missingMigration:'004_pod.sql'}),r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code==='SCHEMA_CHECKSUMS').status,'BLOCKED');
});
test('missing provider listing uniqueness migration blocks preflight',async()=>{
 const f=fixture({missingMigration:'005_pod.sql'}),r=await preflight(f.options);
 assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.code==='SCHEMA_CHECKSUMS').status,'BLOCKED');
});

