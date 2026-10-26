import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};

function fixture({platform='kdp',prior=false,weekly=0}={}){
 const job={id:'00000000-0000-4000-8000-000000000001',account_id:'00000000-0000-4000-8000-000000000002',
  platform,state:'qa_passed',attempt:0,fencing_token:'0'};
 const queries=[];
 const client={
  async query(sql,params=[]){
   if(typeof sql!=='string'){params=sql.values??params;sql=sql.text;}
   queries.push({sql,params});
   if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql==='SELECT id FROM pod_accounts WHERE id=$1 FOR UPDATE')return {rows:[{id:job.account_id}]};
   if(sql.startsWith('SELECT * FROM pod_accounts'))return {rows:[{id:job.account_id,platform,state:'ACTIVE',daily_cap:10}]};
   if(sql.startsWith('SELECT 1 FROM pod_production_queue WHERE account_id='))return {rows:[]};
   if(sql.startsWith('SELECT count(*)::int AS n FROM pod_quota_reservations'))return {rows:[{n:0}]};
   if(sql.startsWith('SELECT q.* FROM pod_production_queue'))return {rows:[job]};
   if(sql.startsWith('SELECT 1 FROM pod_quota_reservations r JOIN pod_production_queue'))return {rows:prior?[{}]:[]};
   if(sql.startsWith('SELECT count(DISTINCT r.job_id)::int AS n'))return {rows:[{n:weekly}]};
   if(sql.startsWith('UPDATE pod_production_queue SET state='))return {rows:[{...job,state:'publishing',attempt:1,fencing_token:'1'}]};
   if(sql.startsWith('INSERT INTO pod_quota_reservations')||sql.startsWith('UPDATE pod_accounts SET next_allowed_at='))return {rows:[]};
   throw Error('unexpected SQL: '+sql);
  },
  release(){}
 };
 const db=new PodDB({bridge,expiresAt:'2099-01-01T00:00:00Z',pool:{connect:async()=>client}});
 return {db,job,queries};
}

test('KDP blocks a third distinct paperback title in the current Sunday UTC week',async()=>{
 const {db,job,queries}=fixture({weekly:2});
 assert.equal(await db.claimPublish(job.account_id,45),null);
 const check=queries.find(({sql})=>sql.startsWith('SELECT count(DISTINCT r.job_id)::int AS n'));
 assert.ok(check);
 assert.match(check.sql,/q\.platform='kdp'/);
 assert.match(check.sql,/AT TIME ZONE 'UTC'/);
 assert.match(check.sql,/interval '1 day'/);
 assert.equal(queries.some(({sql})=>sql.startsWith('UPDATE pod_production_queue SET state=')),false);
 assert.equal(queries.some(({sql})=>sql.startsWith('INSERT INTO pod_quota_reservations')),false);
 const prior=queries.find(({sql})=>sql.startsWith('SELECT 1 FROM pod_quota_reservations r JOIN pod_production_queue'));
 assert.match(prior.sql,/provider_id IS NOT NULL/);
 assert.match(prior.sql,/AT TIME ZONE 'UTC'/);
});

test('KDP allows first and second distinct titles and records the attempt',async()=>{
 for(const weekly of [0,1]){
  const {db,job,queries}=fixture({weekly});
  const claimed=await db.claimPublish(job.account_id,45);
  assert.equal(claimed.id,job.id);
  assert.equal(claimed.state,'publishing');
  assert.ok(queries.some(({sql})=>sql.startsWith('INSERT INTO pod_quota_reservations')));
 }
});

test('KDP retry or update of an already submitted durable job does not consume a new weekly title',async()=>{
 const {db,job,queries}=fixture({prior:true,weekly:2});
 assert.equal((await db.claimPublish(job.account_id,45)).id,job.id);
 assert.equal(queries.some(({sql})=>sql.startsWith('SELECT count(DISTINCT r.job_id)::int AS n')),false);
});

test('non-KDP accounts retain the rolling daily cap without a KDP weekly query',async()=>{
 const {db,job,queries}=fixture({platform:'redbubble',weekly:2});
 assert.equal((await db.claimPublish(job.account_id,45)).id,job.id);
 assert.equal(queries.some(({sql})=>sql.startsWith('SELECT 1 FROM pod_quota_reservations r JOIN pod_production_queue')),false);
 assert.equal(queries.some(({sql})=>sql.startsWith('SELECT count(DISTINCT r.job_id)::int AS n')),false);
});
