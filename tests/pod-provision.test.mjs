import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {migrate} from '../scripts/pod_storage_init.mjs';

for(const rollbackFails of [false,true])test(`migration ${rollbackFails?'discards an unrolled-back backend':'reuses a successfully rolled-back backend'}`,
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.POD_TEST_DATABASE_URL,max:1});
 const role='pod_cleanup_'+crypto.randomBytes(5).toString('hex');
 const original=Error('STORAGE_EXPIRING');let checks=0,rollbacks=0,released;
 try{
  const before=(await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const borrowed={connect:async()=>{
   const client=await pool.connect();
   return {query:async(...args)=>{
    if(args[0]==='ROLLBACK'){
     rollbacks++;
     // Inject a failed rollback before PostgreSQL receives it. The real
     // transaction stays open until the real pg pool discards the backend.
     if(rollbackFails)throw Error('fixture rollback transport failure');
    }
    return client.query(...args);
   },release:destroy=>{released=Boolean(destroy);client.release(destroy);}};
  }};
  await assert.rejects(migrate(borrowed,role,undefined,{
   provisionPassword:'fixture-cleanup-password-'.repeat(3),
   assertActive:()=>{if(++checks===2)throw original;},
  }),error=>error===original);
  assert.equal(checks,2);assert.equal(rollbacks,1);assert.equal(released,rollbackFails);
  assert.equal(pool.totalCount,rollbackFails?0:1);
  const after=(await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.equal(after===before,!rollbackFails);
  assert.equal((await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount,0);
  // A fresh transaction can acquire the migration lock after cleanup.
  const client=await pool.connect();
  try{
   await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'");
   await client.query('SELECT pg_advisory_xact_lock($1)',[543210]);
   await client.query('ROLLBACK');
  }finally{client.release();}
 }finally{await pool.end();}
});

test('confirmed privileged migration destroys its backend before pool reuse',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.POD_TEST_DATABASE_URL,max:1});
 const role='pod_success_'+crypto.randomBytes(5).toString('hex');
 try{
  const before=(await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  await migrate(pool,role,undefined,{provisionPassword:'fixture-success-password-'.repeat(3)});
  assert.equal(pool.totalCount,0);
  const after=(await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.notEqual(after,before);
 }finally{
  await pool.query(`DROP OWNED BY "${role}"`).catch(()=>{});
  await pool.query(`DROP ROLE IF EXISTS "${role}"`).catch(()=>{});
  await pool.end();
 }
});

test('invalid provision identity and short secrets fail before database access',async()=>{
 const pool={connect:()=>{throw Error('must not connect');}};
 await assert.rejects(migrate(pool,'unrelated_user',undefined,{provisionPassword:'a'.repeat(40)}),/PROVISION_CONFIG_INVALID/);
 await assert.rejects(migrate(pool,'pod_runtime',undefined,{provisionPassword:'short'}),/PROVISION_CONFIG_INVALID/);
});
test('provisioning is transactional, repeatable and grants only POD access',{skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.POD_TEST_DATABASE_URL});
 const role='pod_provision_'+crypto.randomBytes(5).toString('hex');
 const elevated='pod_elevated_'+crypto.randomBytes(5).toString('hex');
 const password="fixture-only-quote'"+'a'.repeat(40);
 try{
  await pool.query('CREATE TABLE IF NOT EXISTS cyzor_social_vault(id text PRIMARY KEY,envelope jsonb NOT NULL)');
  await migrate(pool,role,undefined,{provisionPassword:password});
  const before=(await pool.query('SELECT rolpassword FROM pg_authid WHERE rolname=$1',[role])).rows[0].rolpassword;
  assert.match(before,/^SCRAM-SHA-256/);
  await migrate(pool,role,undefined,{provisionPassword:'different-fixture-password-'.repeat(3)});
  assert.equal((await pool.query('SELECT rolpassword FROM pg_authid WHERE rolname=$1',[role])).rows[0].rolpassword,before);
  const flags=(await pool.query('SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];
  assert.equal(flags.rolcanlogin,true);
  assert.equal(Object.entries(flags).some(([k,v])=>k!=='rolcanlogin'&&v),false);
  assert.equal((await pool.query("SELECT has_table_privilege($1,'pod_events','INSERT') AS access",[role])).rows[0].access,true);
  assert.equal((await pool.query("SELECT has_table_privilege($1,'cyzor_social_vault','SELECT,INSERT,UPDATE,DELETE') AS access",[role])).rows[0].access,false);
  let safetyChecks=0;
  await assert.rejects(migrate(pool,elevated,undefined,{provisionPassword:password,assertActive:()=>{
   if(++safetyChecks===2)throw Error('STORAGE_EXPIRING');
  }}),/STORAGE_EXPIRING/);
  assert.equal(safetyChecks,2);
  // The role and grants existed inside the transaction but must not survive.
  assert.equal((await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[elevated])).rowCount,0);
  await assert.rejects(migrate(pool,elevated,new URL('./missing-migrations/',import.meta.url),{provisionPassword:password}));
  assert.equal((await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[elevated])).rowCount,0);
  await pool.query(`CREATE ROLE "${elevated}" NOINHERIT`);
  const owner=(await pool.query('SELECT current_user AS name')).rows[0].name;
  // CI owner is postgres; membership must be rejected even with NOINHERIT.
  await pool.query(`GRANT "${owner.replaceAll('"','""')}" TO "${elevated}"`);
  await assert.rejects(migrate(pool,elevated),/RUNTIME_ROLE_PRIVILEGED/);
 }finally{
  for(const name of [role,elevated]){
   await pool.query(`DROP OWNED BY "${name}"`).catch(()=>{});
   await pool.query(`DROP ROLE IF EXISTS "${name}"`).catch(()=>{});
  }
  await pool.end();
 }
});
