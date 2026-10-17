import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import {migrate} from '../scripts/pod_storage_init.mjs';
import {preflight} from '../scripts/pod_preflight.mjs';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

test('preflight rejects indirect non-inherited and column-level excess privileges',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.POD_TEST_DATABASE_URL);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/pod_test')throw Error('DISPOSABLE_TEST_DATABASE_REQUIRED');
 const token=crypto.randomUUID().replaceAll('-',''),name='pod_acl_'+token;
 const roles=['pod_runtime_'+token,'pod_middle_'+token,'pod_group_'+token];
 const [runtime,middle,group]=roles,created=[];
 const owner=new pg.Pool({connectionString:url.toString(),max:1});let pool,createdDatabase=false;
 const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
 try{
  for(const role of roles){await owner.query(`CREATE ROLE "${role}" NOLOGIN NOINHERIT`);created.push(role);}
  await owner.query(`GRANT "${group}" TO "${middle}" WITH INHERIT FALSE, SET TRUE`);
  await owner.query(`GRANT "${middle}" TO "${runtime}" WITH INHERIT FALSE, SET TRUE`);
  await owner.query(`CREATE DATABASE "${name}" TEMPLATE template0`);createdDatabase=true;
  const target=new URL(url);target.pathname='/'+name;
  pool=new pg.Pool({connectionString:target.toString(),max:2});await migrate(pool,runtime);
  // Empty, isolated ACL fixture only. No live vault connection or content read.
  await pool.query('CREATE TABLE public.cyzor_social_vault(id text)');
  const inspect=()=>preflight({env:{PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',
   POD_DATABASE_URL:'fixture',POD_BRIDGE_PATH:'fixture',POD_STORAGE_EXPIRES_AT:'2099-01-01T00:00:00Z',
   POD_UPSTREAM_KEY:'u'.repeat(32),POD_QA_KEY:'q'.repeat(32),INTERNAL_OPERATIONS_KEY:'o'.repeat(32)},
   readFile:(p,encoding)=>p==='fixture'?JSON.stringify(bridge):fs.readFile(p,encoding),
   connect:async()=>({connect:async()=>{
    const c=await pool.connect();try{await c.query(`SET ROLE "${runtime}"`);}catch(e){c.release(true);throw e;}
    return {query:(...args)=>c.query(...args),release:()=>c.release(true)};
   },end:async()=>{}})});
  const status=(report,code)=>report.checks.find(c=>c.code===code)?.status;
  const clean=async()=>{
   const report=await inspect();
   for(const code of ['DATABASE_READABLE','RESTRICTED_RUNTIME_ROLE','POD_TABLE_PRIVILEGES','SOCIAL_VAULT_ISOLATED','SCHEMA_CHECKSUMS'])assert.equal(status(report,code),'PASS',code);
   assert.equal(status(report,'DATABASE_TLS'),'BLOCKED'); // Local fixture does not establish production TLS.
  };
  await clean();
  // A harmless member role remains allowed; membership alone is not a failure.
  await pool.query(`GRANT SELECT ON public.pod_events TO "${group}"`);await clean();
  const cases=[
   ['DELETE ON public.pod_events','POD_TABLE_PRIVILEGES',"has_table_privilege($1,'public.pod_events','DELETE')"],
   ['REFERENCES (id) ON public.pod_events','POD_TABLE_PRIVILEGES',"has_any_column_privilege($1,'public.pod_events','REFERENCES')"],
   ['UPDATE (sha256) ON public.pod_schema_version','POD_TABLE_PRIVILEGES',"has_any_column_privilege($1,'public.pod_schema_version','UPDATE')"],
   [`CREATE ON DATABASE "${name}"`,'RESTRICTED_RUNTIME_ROLE',"has_database_privilege($1,current_database(),'CREATE')"],
   ['CREATE ON SCHEMA public','RESTRICTED_RUNTIME_ROLE',"has_schema_privilege($1,'public','CREATE')"],
   ['SELECT ON public.cyzor_social_vault','SOCIAL_VAULT_ISOLATED',"has_table_privilege($1,'public.cyzor_social_vault','SELECT')"],
   ['UPDATE (id) ON public.cyzor_social_vault','SOCIAL_VAULT_ISOLATED',"has_any_column_privilege($1,'public.cyzor_social_vault','UPDATE')"],
  ];
  for(const [privilege,code,probe] of cases){
   await pool.query(`GRANT ${privilege} TO "${group}"`);
   try{
    // The old effective-privilege predicate is false, but this member role is
    // reachable through SET ROLE and has the prohibited privilege.
    const row=(await pool.query(`SELECT ${probe} AS effective,pg_has_role($1,$2,'SET') AS reachable`,[runtime,group])).rows[0];
    assert.deepEqual(row,{effective:false,reachable:true},privilege);
    assert.equal((await pool.query(`SELECT ${probe} AS granted`,[group])).rows[0].granted,true);
    const report=await inspect();assert.equal(status(report,'DATABASE_READABLE'),'PASS');
    assert.equal(status(report,code),'BLOCKED',privilege);
   }finally{await pool.query(`REVOKE ${privilege} FROM "${group}"`);}
   await clean();
  }
  // Column ACLs on the schema ledger also evade table-level INSERT/UPDATE checks.
  await pool.query(`GRANT UPDATE (sha256) ON public.pod_schema_version TO "${runtime}"`);
  try{
   assert.equal((await pool.query("SELECT has_table_privilege($1,'public.pod_schema_version','UPDATE') AS granted",[runtime])).rows[0].granted,false);
   assert.equal(status(await inspect(),'POD_TABLE_PRIVILEGES'),'BLOCKED');
  }finally{await pool.query(`REVOKE UPDATE (sha256) ON public.pod_schema_version FROM "${runtime}"`);}
  await clean();
 }finally{
  if(pool)await pool.end();
  if(createdDatabase)await owner.query(`DROP DATABASE "${name}"`);
  for(const role of created.reverse())await owner.query(`DROP ROLE "${role}"`);
  await owner.end();
 }
});
