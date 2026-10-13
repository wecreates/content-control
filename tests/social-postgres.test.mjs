import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {PostgresSocialStore, postgresPoolOptions, initializePostgresVault} from '../integrations/social-automation/postgres-store.mjs';
const key='d'.repeat(64),future='2030-01-01T00:00:00Z';
test('database configuration enforces verified TLS and rejects SSL overrides',()=>{
 const options=postgresPoolOptions('postgres://owner:password@db.example.test/vault?sslmode=require');
 assert.deepEqual(options.ssl,{rejectUnauthorized:true});assert.equal(options.connectionString,undefined);
 for(const url of ['http://user:pass@host/db','postgres://host/db','postgres://u:p@host/db?sslmode=disable','postgres://u:p@host/db?sslrootcert=bad','postgres://u:p@host/db#fragment'])assert.throws(()=>postgresPoolOptions(url),/CONFIGURATION/);
});
test('vault encryption detects wrong keys and tampering; expiry blocks reads and writes',async()=>{
 let calls=0;const pool={query:()=>{calls++;}};
 const store=new PostgresSocialStore({pool,key,expiresAt:future});const data={version:1,connections:{instagram:{access_token:'PRIVATE_TOKEN'}},jobs:[]};
 const envelope=store.seal(data);assert.ok(!JSON.stringify(envelope).includes('PRIVATE_TOKEN'));assert.deepEqual(store.open(envelope),data);
 assert.throws(()=>new PostgresSocialStore({pool,key:'e'.repeat(64),expiresAt:future}).open(envelope),/INTEGRITY/);
 assert.throws(()=>store.open({...envelope,data:Buffer.from('tampered').toString('base64')}),/INTEGRITY/);
 const expired=new PostgresSocialStore({pool,key,expiresAt:'2020-01-01'});await assert.rejects(expired.read(),/EXPIRING/);await assert.rejects(expired.update(()=>{}),/EXPIRING/);assert.equal(calls,0);
 assert.throws(()=>new PostgresSocialStore({pool,key}),/EXPIRY/);
});
test('transaction releases client and rolls back without leaking database errors',async()=>{
 const commands=[];const client={query:async sql=>{commands.push(sql);if(sql.includes('FOR UPDATE'))throw Object.assign(Error('PRIVATE_DATABASE_PASSWORD'),{code:'55P03'});},release:()=>commands.push('release')};
 const store=new PostgresSocialStore({pool:{connect:async()=>client},key,expiresAt:future});
 await assert.rejects(store.update(()=>{}),e=>e.message==='PRIVATE_STORE_BUSY');assert.deepEqual(commands,['BEGIN',"SET LOCAL lock_timeout='2s'","SET LOCAL statement_timeout='15s'",'SELECT envelope FROM cyzor_social_vault WHERE id=$1 FOR UPDATE','ROLLBACK','release']);
});
test('real PostgreSQL: restart persistence, idempotent initialization, rollback, concurrency and wrong-key protection', {skip:!process.env.SOCIAL_TEST_DATABASE_URL},async()=>{
 // Disposable CI database only. Production construction always uses verified TLS.
 const pool=new pg.Pool({connectionString:process.env.SOCIAL_TEST_DATABASE_URL,max:3});
 const store=new PostgresSocialStore({pool,key,expiresAt:future});
 try{
  await initializePostgresVault(store);await store.update(d=>{d.connections.instagram={access_token:'PRIVATE_TOKEN'};d.counter=0;});
  await initializePostgresVault(store);assert.equal((await store.read()).connections.instagram.access_token,'PRIVATE_TOKEN');
  const otherPool=new pg.Pool({connectionString:process.env.SOCIAL_TEST_DATABASE_URL,max:2});
  const other=new PostgresSocialStore({pool:otherPool,key,expiresAt:future});
  try{
   assert.equal((await other.read()).connections.instagram.access_token,'PRIVATE_TOKEN');
   await Promise.all(Array.from({length:8},(_,i)=>(i%2?store:other).update(d=>{d.counter++;})));
   assert.equal((await store.read()).counter,8);
   await assert.rejects(other.update(d=>{d.counter=999;throw Error('ABORT_TEST');}),/ABORT_TEST/);assert.equal((await store.read()).counter,8);
   const wrong=new PostgresSocialStore({pool:otherPool,key:'e'.repeat(64),expiresAt:future});await assert.rejects(wrong.read(),/INTEGRITY/);await assert.rejects(initializePostgresVault(wrong),/INITIALIZATION/);assert.equal((await store.read()).counter,8);
   const raw=await pool.query('SELECT envelope FROM cyzor_social_vault');assert.ok(!JSON.stringify(raw.rows).includes('PRIVATE_TOKEN'));
  } finally{await other.close();}
 } finally{await store.close();}
});
