import test from 'node:test';
import assert from 'node:assert/strict';
import {migrate} from '../scripts/pod_storage_init.mjs';
import {deploymentFailure} from '../scripts/pod_deploy_database.mjs';

for(const stage of ['BEGIN','lock','safety'])for(const rollbackFails of [false,true]){
 test(`migration preserves ${stage} failure and ${rollbackFails?'discards':'reuses'} its client after rollback`,async()=>{
  const original=Error('STORAGE_EXPIRING');
  const cleanup=Error('fixture-secret-password in rollback diagnostic');
  const queries=[],releases=[];
  const client={query:async sql=>{
   queries.push(sql);
   if(sql==='ROLLBACK'){if(rollbackFails)throw cleanup;return {rows:[]};}
   if(sql===stage||(stage==='lock'&&sql.includes('pg_advisory_xact_lock')))throw original;
   return {rows:[]};
  },release:destroy=>releases.push(Boolean(destroy))};
  await assert.rejects(migrate({connect:async()=>client},'pod_runtime',undefined,
   {assertActive:()=>{throw original;}}),error=>error===original);
  assert.deepEqual(releases,[rollbackFails]);
  assert.equal(queries.filter(sql=>sql==='ROLLBACK').length,1);
  assert.equal(queries.at(-1),'ROLLBACK');
  assert.equal(queries.includes('COMMIT'),false);
  assert.equal(queries.some(sql=>/^(CREATE|GRANT|INSERT)/.test(sql)),false);
  assert.deepEqual(deploymentFailure(original),{status:'BLOCKED',reason:'STORAGE_EXPIRING',publication_enabled:false});
  assert.equal(JSON.stringify(deploymentFailure(original)).includes('fixture-secret'),false);
 });
}

test('migration connection failure does not attempt transaction cleanup',async()=>{
 const original=Error('connection unavailable');let releases=0,queries=0;
 const pool={connect:async()=>{throw original;},query:async()=>{queries++;},release:()=>{releases++;}};
 await assert.rejects(migrate(pool,'pod_runtime'),error=>error===original);
 assert.equal(queries,0);assert.equal(releases,0);
});
