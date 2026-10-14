import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentConfig,deployDatabase} from '../scripts/pod_deploy_database.mjs';
const env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',
 POD_STORAGE_EXPIRES_AT:'2099-01-01T00:00:00Z',DATABASE_RUNTIME_USER:'pod_worker',
 DATABASE_MIGRATION_URL:'postgresql://owner:secret@db.example/pod?sslmode=verify-full',
 POD_DATABASE_URL:'postgresql://pod_worker:secret@db.example/pod?sslmode=require'};
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
