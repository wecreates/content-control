import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const expiresAt='2099-01-01T00:00:00Z';

for(const phase of ['ROLLBACK','DISCARD ALL'])test('managed transactions destroy clients after unverified '+phase,async()=>{
 const original=Error('fixture business failure');
 for(const method of ['read','tx']){
  const queries=[],releases=[];
  const client={query:async sql=>{
   const text=typeof sql==='string'?sql:sql.text;queries.push(text);
   if(text===phase)return {command:'SELECT'};
   if(text.startsWith('BEGIN'))return {command:'BEGIN'};
   if(text==='COMMIT')return {command:'COMMIT'};
   if(text==='SELECT fixture'&&phase==='ROLLBACK')throw original;
   return {rows:[{value:1}]};
  },release:discard=>releases.push(discard)};
  const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt});
  const operation=method==='read'?db.read('SELECT fixture'):db.tx(c=>c.query('SELECT fixture'));
  if(phase==='ROLLBACK')await assert.rejects(operation,e=>e===original);
  else assert.deepEqual((await operation).rows,[{value:1}]);
  assert.equal(queries.at(-1),phase);
  assert.deepEqual(releases,[true]);
 }
});

test('managed reads and writes stop before any dependent SQL without a verified BEGIN',async()=>{
 let executableReads=0;
 const outcomes=[{command:'SELECT'},undefined,{},Object.create({command:'BEGIN'}),
  Object.assign([],{command:'BEGIN'}),{get command(){executableReads++;return 'BEGIN';}},
  new Proxy({command:'BEGIN'},{getOwnPropertyDescriptor(){executableReads++;return {};}})];
 for(const method of ['read','tx'])for(const outcome of outcomes){
  const begin=method==='read'?'BEGIN READ ONLY':'BEGIN',queries=[],releases=[];
  const client={query:async sql=>{const text=typeof sql==='string'?sql:sql.text;queries.push(text);
   return text===begin?outcome:text==='COMMIT'?{command:'COMMIT'}:{rows:[{value:1}]};},
  release:bad=>releases.push(bad)};
  const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt});
  await assert.rejects(method==='read'?db.read('SELECT 1'):db.tx(c=>c.query('SELECT 1')),/^Error: POD_BEGIN_UNVERIFIED$/);
  assert.deepEqual(queries,[begin]);assert.deepEqual(releases,[true]);
 }
 assert.equal(executableReads,0);
});

test('managed reads and writes cannot report success after unverified COMMIT',async()=>{
 let executableReads=0;
 const outcomes=[{command:'ROLLBACK'},undefined,{},Object.create({command:'COMMIT'}),
  Object.assign([],{command:'COMMIT'}),{get command(){executableReads++;return 'COMMIT';}},
  new Proxy({command:'COMMIT'},{getOwnPropertyDescriptor(){executableReads++;return {};}})];
 for(const method of ['read','tx'])for(const outcome of outcomes){
  const queries=[],releases=[];
  const client={query:async sql=>{const text=typeof sql==='string'?sql:sql.text;queries.push(text);
   return text==='COMMIT'?outcome:text.startsWith('BEGIN')?{command:'BEGIN'}:{rows:[{value:1}]};},release:bad=>releases.push(bad)};
  const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt});
  await assert.rejects(method==='read'?db.read('SELECT 1'):db.tx(c=>c.query('SELECT 1')),/POD_COMMIT_UNVERIFIED/);
  assert.deepEqual(queries.slice(-2),['SELECT 1','COMMIT']);
  assert.deepEqual(releases,[true]);
 }
 assert.equal(executableReads,0);
});

test('PostgreSQL SELECT substituted for BEGIN cannot cause an autocommit write',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
  const connectionString=process.env.POD_TEST_DATABASE_URL;
  const url=new URL(connectionString);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'disposable local PostgreSQL only');
  assert.equal(url.pathname,'/pod_test');
  assert.equal(process.env.PUBLICATION_ENABLED,'false');
  assert.equal(process.env.POD_PUBLICATION_ENABLED,'false');
  const {default:pg}=await import('pg');
  const pool=new pg.Pool({connectionString,max:1});
  const table='pod_begin_evidence_'+randomBytes(8).toString('hex');
  try{
   await pool.query(`CREATE TABLE ${table}(id int PRIMARY KEY)`);
   for(const method of ['read','tx']){
    const begin=method==='read'?'BEGIN READ ONLY':'BEGIN',queries=[],releases=[];
    let tag;
    const faulty=new PodDB({bridge,expiresAt,pool:{connect:async()=>{
     const client=await pool.connect();
     return {release:bad=>{releases.push(bad);client.release(bad);},query:async(...args)=>{
      const sql=typeof args[0]==='string'?args[0]:args[0].text;
      queries.push(sql);
      if(sql!==begin)return client.query(...args);
      const result=await client.query('SELECT 1');tag=result.command;return result;
     }};
    }}});
    const insert=`INSERT INTO ${table} VALUES ($1) RETURNING id`;
    await assert.rejects(method==='read'?faulty.read(insert,[1]):faulty.tx(c=>c.query(insert,[1])),/^Error: POD_BEGIN_UNVERIFIED$/);
    assert.equal(tag,'SELECT');assert.deepEqual(queries,[begin]);assert.deepEqual(releases,[true]);
    assert.equal((await pool.query(`SELECT id FROM ${table}`)).rowCount,0);
   }
   const healthy=new PodDB({pool,bridge,expiresAt});
   await assert.rejects(healthy.read(`INSERT INTO ${table} VALUES (1)`),error=>error.code==='25006');
   await healthy.tx(c=>c.query(`INSERT INTO ${table} VALUES (1)`));
   assert.deepEqual((await healthy.read(`SELECT id FROM ${table}`)).rows,[{id:1}]);
  }finally{
   try{await pool.query(`DROP TABLE IF EXISTS ${table}`);}finally{await pool.end();}
  }
 });

test('real PostgreSQL cleanup tags keep poisoned sessions out of the managed pool',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
  const url=new URL(process.env.POD_TEST_DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.pathname==='/pod_test','disposable local PostgreSQL only');
  assert.equal(process.env.PUBLICATION_ENABLED,'false');assert.equal(process.env.POD_PUBLICATION_ENABLED,'false');
  const {default:pg}=await import('pg');
  const pool=new pg.Pool({connectionString:url.toString(),max:1,application_name:'pod-cleanup-fixture'});
  try{
   for(const phase of ['ROLLBACK','DISCARD ALL',null]){
    let observed;const queries=[],releases=[];
    const db=new PodDB({bridge,expiresAt,pool:{connect:async()=>{
     const client=await pool.connect();
     return {release:bad=>{releases.push(bad);client.release(bad);},query:async(...args)=>{
      const sql=typeof args[0]==='string'?args[0]:args[0].text;queries.push(sql);
      if(sql===phase){const result=await client.query('SELECT 1');observed=result.command;return result;}
      const result=await client.query(...args);
      if(!phase&&sql==='DISCARD ALL')observed=result.command;
      return result;
     }};
    }}});
    const original=Error('fixture callback failure');
    const work=db.tx(async c=>{
     const result=await c.query("SELECT set_config('application_name','pod-poisoned-fixture',false) AS name");
     if(phase==='ROLLBACK')throw original;
     return result.rows[0].name;
    });
    if(phase==='ROLLBACK')await assert.rejects(work,e=>e===original);
    else assert.equal(await work,'pod-poisoned-fixture');
    assert.equal(observed,phase?'SELECT':'DISCARD');assert.deepEqual(releases,[Boolean(phase)]);
    assert.equal(queries.at(-1),phase??'DISCARD ALL');
    assert.equal(pool.totalCount,phase?0:1);
    assert.equal((await pool.query('SHOW application_name')).rows[0].application_name,'pod-cleanup-fixture');
   }
  }finally{await pool.end();}
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
