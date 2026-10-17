import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {deploymentConfig,deployDatabase} from '../scripts/pod_deploy_database.mjs';
const env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',
 POD_STORAGE_EXPIRES_AT:'2099-01-01T00:00:00Z',DATABASE_RUNTIME_USER:'pod_worker',
 DATABASE_MIGRATION_URL:'postgresql://owner:secret@db.example/pod?sslmode=verify-full',
 POD_DATABASE_URL:'postgresql://pod_worker:secret@db.example/pod?sslmode=require'};
const databasePass=()=>({checks:['RESTRICTED_RUNTIME_ROLE','DATABASE_TLS','POD_TABLE_PRIVILEGES',
 'SOCIAL_VAULT_ISOLATED','SCHEMA_CHECKSUMS','DATABASE_READABLE'].map(code=>({code,status:'PASS'}))});
for(const boundary of ['connect','lock','commit'])for(const change of ['storage','PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED']){
 test('migration rolls back when '+change+' changes at '+boundary,async t=>{
  let now=1800000000000;t.mock.method(Date,'now',()=>now);
  const settings={...env,POD_STORAGE_EXPIRES_AT:new Date(now+86400001).toISOString()};
  const statements=[];let released=0,closed=0;
  const invalidate=()=>{if(change==='storage')now++;else settings[change]='true';};
  const client={release:()=>{released++;},query:async(sql,params)=>{
   statements.push(sql);
   if(boundary==='lock'&&sql.includes('pg_advisory_xact_lock'))invalidate();
   if(boundary==='commit'&&sql.startsWith('GRANT SELECT ON pod_schema_version'))invalidate();
   if(sql.startsWith('SELECT rolsuper'))return {rows:[{}]};
   if(sql==='SELECT current_user AS name')return {rows:[{name:'owner'}]};
   if(sql.includes('AS elevated'))return {rows:[{elevated:false}]};
   if(sql.startsWith('SELECT sha256')){
    const bytes=await fs.readFile(new URL('../migrations/'+params[0],import.meta.url));
    return {rows:[{sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]};
   }
   return {rows:[]};
  }};
  const pool={connect:async()=>{if(boundary==='connect')invalidate();return client;},end:async()=>{closed++;}};
  await assert.rejects(deployDatabase({env:settings,apply:true,connect:async()=>pool,
   inspect:async()=>assert.fail('inspection must not run')}),change==='storage'?/STORAGE_EXPIRING/:/PUBLICATION_MUST_BE_DISABLED/);
  assert.equal(statements.at(-1),'ROLLBACK');assert.equal(statements.includes('COMMIT'),false);
  assert.equal(released,1);assert.equal(closed,1);
  if(boundary!=='commit')assert.equal(statements.some(sql=>/^(CREATE|GRANT|INSERT)/.test(sql)),false);
  else assert.equal(statements.some(sql=>sql.startsWith('GRANT SELECT ON pod_schema_version')),true);
 });
}
test('check-only cannot report database verification after storage crosses its safety cutoff',async t=>{
 let now=1800000000000;t.mock.method(Date,'now',()=>now);
 const settings={...env,POD_STORAGE_EXPIRES_AT:new Date(now+86400001).toISOString()};
 await assert.rejects(deployDatabase({env:settings,inspect:async()=>{now++;return databasePass();}}),/STORAGE_EXPIRING/);
});
for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED'])test('check-only rechecks '+flag+' after inspection',async()=>{
 const settings={...env};
 await assert.rejects(deployDatabase({env:settings,inspect:async()=>{settings[flag]='true';return databasePass();}}),/PUBLICATION_MUST_BE_DISABLED/);
});
test('expired storage after owner pool creation blocks before any migration query and closes the pool',async t=>{
 let now=1800000000000,queries=0,closed=0;t.mock.method(Date,'now',()=>now);
 const settings={...env,POD_STORAGE_EXPIRES_AT:new Date(now+86400001).toISOString()};
 const pool={connect:async()=>{queries++;throw Error('MIGRATION_CONNECTION_REACHED');},end:async()=>{closed++;}};
 await assert.rejects(deployDatabase({env:settings,apply:true,connect:async()=>{now++;return pool;},
  inspect:async()=>{assert.fail('inspection must not run');}}),/STORAGE_EXPIRING/);
 assert.equal(queries,0);assert.equal(closed,1);
});
test('check-only can complete while storage remains strictly outside the cutoff',async t=>{
 let now=1800000000000;t.mock.method(Date,'now',()=>now);
 const settings={...env,POD_STORAGE_EXPIRES_AT:new Date(now+86400002).toISOString()};
 const result=await deployDatabase({env:settings,inspect:async()=>{now++;return databasePass();}});
 assert.equal(result.status,'DATABASE_VERIFIED');assert.equal(result.publication_enabled,false);
});
for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED'])test('owner pool cleanup follows a newly enabled '+flag,async()=>{
 const settings={...env};let accessed=false,closed=false;
 const pool={connect:async()=>{accessed=true;throw Error('MIGRATION_CONNECTION_REACHED');},end:async()=>{closed=true;}};
 await assert.rejects(deployDatabase({env:settings,apply:true,connect:async()=>{settings[flag]='true';return pool;},
  inspect:async()=>{assert.fail('inspection must not run');}}),/PUBLICATION_MUST_BE_DISABLED/);
 assert.equal(accessed,false);assert.equal(closed,true);
});
test('deployment requires identical database target and separate restricted identity',()=>{
 assert.deepEqual(deploymentConfig(env),{role:'pod_worker'});
 for(const patch of [
  {POD_DATABASE_URL:'postgresql://pod_worker:secret@other.example/pod'},
  {POD_DATABASE_URL:'postgresql://pod_worker:secret@db.example/other'},
  {POD_DATABASE_URL:'postgresql://owner:secret@db.example/pod',DATABASE_RUNTIME_USER:'owner'},
  {POD_DATABASE_URL:'postgresql://pod_worker:secret@db.example/pod?sslmode=disable'},
  {DATABASE_RUNTIME_USER:'wrong_role'},{PUBLICATION_ENABLED:'true'},
  {POD_PUBLICATION_ENABLED:undefined},{POD_STORAGE_EXPIRES_AT:'2020-01-01'},
 ])assert.throws(()=>deploymentConfig({...env,...patch}));
});
test('check-only never invokes migration connection and missing evidence blocks',async()=>{
 const result=await deployDatabase({env,connect:()=>{throw Error('must not connect as owner');},
  inspect:async({env:received})=>{assert.equal(received.POD_DATABASE_URL,env.POD_DATABASE_URL);return {checks:[]};}});
 assert.equal(result.status,'BLOCKED');assert.equal(result.migration_requested,false);
 assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.equal(result.checks.length,6);
});
test('runtime verification is explicitly database-only',async()=>{
 const codes=['RESTRICTED_RUNTIME_ROLE','DATABASE_TLS','POD_TABLE_PRIVILEGES','SOCIAL_VAULT_ISOLATED','SCHEMA_CHECKSUMS','DATABASE_READABLE'];
 const result=await deployDatabase({env,inspect:async()=>({checks:codes.map(code=>({code,status:'PASS'}))})});
 assert.equal(result.status,'DATABASE_VERIFIED');assert.equal(result.production_enabled,false);assert.equal(result.publication_enabled,false);
});
test('role provisioning cannot silently turn check-only into a mutation',async()=>{
 await assert.rejects(deployDatabase({env,provision:true,connect:()=>{throw Error('must not connect');}}),/PROVISION_REQUIRES_APPLY/);
});
