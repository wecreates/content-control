import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const expiresAt='2099-01-01T00:00:00Z';

test('managed reads and writes cannot report success after unverified COMMIT',async()=>{
 let executableReads=0;
 const outcomes=[{command:'ROLLBACK'},undefined,{},Object.create({command:'COMMIT'}),
  Object.assign([],{command:'COMMIT'}),{get command(){executableReads++;return 'COMMIT';}},
  new Proxy({command:'COMMIT'},{getOwnPropertyDescriptor(){executableReads++;return {};}})];
 for(const method of ['read','tx'])for(const outcome of outcomes){
  const queries=[],releases=[];
  const client={query:async sql=>{const text=typeof sql==='string'?sql:sql.text;queries.push(text);
   return text==='COMMIT'?outcome:{rows:[{value:1}]};},release:bad=>releases.push(bad)};
  const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt});
  await assert.rejects(method==='read'?db.read('SELECT 1'):db.tx(c=>c.query('SELECT 1')),/POD_COMMIT_UNVERIFIED/);
  assert.deepEqual(queries.slice(-2),['SELECT 1','COMMIT']);
  assert.deepEqual(releases,[true]);
 }
 assert.equal(executableReads,0);
});

test('PostgreSQL rollback tag leaves a managed write uncommitted and retryable',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
  const connectionString=process.env.POD_TEST_DATABASE_URL;
  const url=new URL(connectionString);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'disposable local PostgreSQL only');
  assert.equal(url.pathname,'/pod_test');
  assert.equal(process.env.PUBLICATION_ENABLED,'false');
  assert.equal(process.env.POD_PUBLICATION_ENABLED,'false');
  const {default:pg}=await import('pg');
  const pool=new pg.Pool({connectionString,max:1});
  const table='pod_commit_evidence_'+randomBytes(8).toString('hex');
  let tag,discarded;
  try{
   await pool.query(`CREATE TABLE ${table}(id int PRIMARY KEY)`);
   const faulty=new PodDB({bridge,expiresAt,pool:{connect:async()=>{
    const client=await pool.connect();
    return {release:bad=>{discarded=bad;client.release(bad);},query:async(...args)=>{
     if(args[0]==='COMMIT')await assert.rejects(client.query('SELECT 1/0'),error=>error.code==='22012');
     const result=await client.query(...args);
     if(args[0]==='COMMIT')tag=result.command;
     return result;
    }};
   }}});
   const insert=db=>db.tx(c=>c.query(`INSERT INTO ${table} VALUES ($1) RETURNING id`,[1]));
   await assert.rejects(insert(faulty),/POD_COMMIT_UNVERIFIED/);
   assert.equal(tag,'ROLLBACK');assert.equal(discarded,true);
   assert.equal((await pool.query(`SELECT id FROM ${table}`)).rowCount,0);
   const healthy=new PodDB({pool,bridge,expiresAt});
   assert.deepEqual((await insert(healthy)).rows,[{id:1}]);
   assert.deepEqual((await healthy.read(`SELECT id FROM ${table}`)).rows,[{id:1}]);
  }finally{
   try{await pool.query(`DROP TABLE IF EXISTS ${table}`);}finally{await pool.end();}
  }
 });
