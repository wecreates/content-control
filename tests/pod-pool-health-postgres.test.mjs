import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {monitorPodPool} from '../integrations/pod/pool-health.mjs';
import {createPodPool} from '../pod-db-bridge.js';

test('runtime pool installs monitoring before any connection and preserves TLS/session limits',async()=>{
 const pool=await createPodPool({POD_DATABASE_URL:'postgresql://fixture:fixture@127.0.0.1:5432/fixture'});
 try{
  assert.equal(pool.options.ssl.rejectUnauthorized,true);assert.equal(pool.options.max,2);
  assert.equal(pool.options.options,'-c search_path=pg_catalog,public');
  assert.equal(pool.options.connectionTimeoutMillis,10000);assert.equal(pool.options.query_timeout,15000);
  assert.equal(pool.listenerCount('error'),1);
  assert.doesNotThrow(()=>pool.emit('error',Error('private connection details')));
  assert.equal(pool.podConnectionHealth().idle_connection_failures,1);
 }finally{await pool.end();}
});

test('terminated disposable idle PostgreSQL backend is removed and the pool reconnects',
 {skip:!process.env.POD_TEST_DATABASE_URL,timeout:15000},async()=>{
 const {default:pg}=await import('pg');
 const options={connectionString:process.env.POD_TEST_DATABASE_URL,max:1,
  connectionTimeoutMillis:2000,query_timeout:3000,idleTimeoutMillis:10000};
 const pool=new pg.Pool(options),admin=new pg.Pool(options),health=monitorPodPool(pool);
 try{
  const before=(await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.equal(pool.idleCount,1);
  // Terminate only the backend acquired by this fixture, never arbitrary sessions.
  // once(error) consumes the event only to await it; the permanent handler is
  // already installed and verified above, and records no driver error details.
  const errored=once(pool,'error',{signal:AbortSignal.timeout(5000)});
  const [terminated]=await Promise.all([
   admin.query('SELECT pg_terminate_backend($1) AS terminated',[before]),errored]);
  assert.equal(terminated.rows[0].terminated,true);
  assert.equal(health().idle_connection_failures,1);assert.equal(pool.totalCount,0);
  const after=(await pool.query('SELECT pg_backend_pid() AS pid, 1 AS ok')).rows[0];
  assert.notEqual(after.pid,before);assert.equal(after.ok,1);
  assert.equal(health().idle_connection_failures,1);
 }finally{await Promise.all([pool.end(),admin.end()]);}
});
