import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const accountId='00000000-0000-4000-8000-000000000002';
const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',
 contract:{fail_closed_rules:BRIDGE_RULES}};

test('publish claim leaves a cross-platform queued job untouched',async()=>{
 const queries=[];
 const client={
  async query(sql,params=[]){
   if(typeof sql!=='string'){params=sql.values??params;sql=sql.text;}
   queries.push({sql,params});
   if(sql==='BEGIN'||sql==='BEGIN READ ONLY')return {command:'BEGIN'};
   if(sql==='COMMIT')return {command:'COMMIT'};
   if(sql==='BEGIN'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql==='SELECT id FROM pod_accounts WHERE id=$1 FOR UPDATE')return {rows:[{id:accountId}]};
   if(sql.startsWith('SELECT id,platform,daily_cap FROM pod_accounts'))return {rows:[{
    id:accountId,platform:'kdp',daily_cap:10
   }]};
   if(sql.startsWith('SELECT true AS present FROM pod_production_queue WHERE account_id='))return {rows:[]};
   if(sql.startsWith('SELECT count(*)::int AS n FROM pod_quota_reservations'))return {rows:[{n:0}]};
   if(sql.startsWith('SELECT q.id,q.account_id,q.platform,q.manifest,q.qa_envelope,')){
    assert.deepEqual(params,[accountId,'kdp']);
    return {rows:[]};
   }
   throw Error('UNEXPECTED_QUERY: '+sql);
  },
  release(){}
 };
 const pool={async connect(){return client;}};
 const db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 const claimed=await db.claimPublish(accountId,45);
 assert.equal(claimed,null);
 assert.equal(queries.some(({sql})=>sql.startsWith('UPDATE pod_production_queue SET state=')),false);
 assert.equal(queries.some(({sql})=>sql.startsWith('INSERT INTO pod_quota_reservations')),false);
});
