import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {financialTotals} from '../integrations/pod/finance.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};

for(const [name,read] of [
 ['release-ready list',db=>db.listReady()],
 ['operations job list',db=>db.listOperationsJobs()]
]){
 test(name+' rechecks storage lifetime after its database wait',async()=>{
  let db;
  const pool={query:async()=>{db.expiresAt=Date.now();return {rows:[]};}};
  db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
  await assert.rejects(read(db),/POD_STORAGE_EXPIRING/);
 });
}

test('financial totals recheck storage lifetime after their database wait',async()=>{
 let db;
 const expected=[{currency:'USD',verified_net_recorded_minor:'125',evidence_count:'2'}];
 const pool={query:async()=>{db.expiresAt=Date.now();return {rows:expected};}};
 db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(financialTotals(db),/POD_STORAGE_EXPIRING/);
});
