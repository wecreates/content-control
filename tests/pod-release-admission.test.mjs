import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
 JSON.stringify(value);
const validManifest={schema_version:1,platform:'redbubble',publication_enabled:false,
 package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
  'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
const validIdentity=crypto.createHash('sha256').update(canonical(validManifest)).digest('hex');

for(const [name,manifest,manifest_sha256] of [
 ['missing QA-passed identity',validManifest,null],
 ['mismatched QA-passed identity',validManifest,'f'.repeat(64)],
 ['invalid durable package',{...validManifest,package_sha256:'invalid'},validIdentity]
])test(`release claim rejects ${name} before quota or cooldown writes`,async()=>{
 const calls=[];
 const client={
  async query(query){
   const sql=typeof query==='string'?query:query.text;calls.push(sql);
   if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql==='DISCARD ALL'||sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql.startsWith('SELECT id FROM pod_accounts'))return {rows:[{id:'account'}]};
   if(sql.startsWith('SELECT * FROM pod_accounts'))return {rows:[{id:'account',platform:'redbubble',state:'ACTIVE',daily_cap:10}]};
   if(sql.startsWith('SELECT 1 FROM pod_production_queue WHERE account_id='))return {rows:[]};
   if(sql.startsWith('SELECT count(*)::int AS n FROM pod_quota_reservations'))return {rows:[{n:0}]};
   if(sql.startsWith('SELECT q.*,'))return {rows:[{id:'job',account_id:'account',platform:'redbubble',
    state:'qa_passed',manifest,manifest_sha256}]};
   if(sql.startsWith('UPDATE pod_production_queue SET state='))return {rows:[{id:'job'}]};
   if(sql.startsWith('INSERT INTO pod_quota_reservations')||sql.startsWith('UPDATE pod_accounts SET next_allowed_at='))return {rows:[]};
   throw Error('UNEXPECTED_QUERY: '+sql);
  },
  release(){}
 };
 const db=new PodDB({pool:{connect:async()=>client},bridge,qaKey:'q'.repeat(48),expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.claimPublish('account',45),/PACKAGE_UNAVAILABLE/);
 assert.equal(calls.some(sql=>sql.startsWith('UPDATE pod_production_queue SET state=')),false);
 assert.equal(calls.some(sql=>sql.startsWith('INSERT INTO pod_quota_reservations')),false);
 assert.equal(calls.some(sql=>sql.startsWith('UPDATE pod_accounts SET next_allowed_at=')),false);
});
