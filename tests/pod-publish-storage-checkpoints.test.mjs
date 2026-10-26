import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};

function fixture(expireOn){
 const calls=[];
 let db;
 const client={
  async query(sql){
   calls.push(sql);
   let rows=[];
   if(sql.startsWith('SELECT id FROM pod_accounts'))rows=[{id:'account'}];
   else if(sql.startsWith('SELECT * FROM pod_accounts'))rows=[{id:'account',platform:'redbubble',daily_cap:10}];
   else if(sql.startsWith('SELECT count(*)::int'))rows=[{n:0}];
   else if(sql.includes('SELECT q.* FROM pod_production_queue'))rows=[{id:'job',platform:'redbubble'}];
   else if(sql.startsWith('UPDATE pod_production_queue'))rows=[{id:'job',attempt:1}];
   if(sql.includes(expireOn))db.expiresAt=0;
   return {rows};
  },
  release(){}
 };
 db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
 return {db,calls};
}

for(const [name,expireOn,forbidden] of [
 ['account lock','SELECT id FROM pod_accounts','SELECT * FROM pod_accounts'],
 ['queue lock','SELECT q.* FROM pod_production_queue','UPDATE pod_production_queue'],
 ['publishing transition','UPDATE pod_production_queue','INSERT INTO pod_quota_reservations'],
 ['quota reservation','INSERT INTO pod_quota_reservations','UPDATE pod_accounts SET next_allowed_at']
])test(`publish claim stops after storage expires during ${name}`,async()=>{
 const {db,calls}=fixture(expireOn);
 await assert.rejects(db.claimPublish('account',45),/POD_STORAGE_EXPIRING/);
 assert.equal(calls.some(sql=>sql.includes(forbidden)),false);
});
