import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
test('invalid publishing delays fail before any database access',async()=>{
 let connections=0;
 const db=new PodDB({bridge,expiresAt:'2099-01-01T00:00:00Z',pool:{connect:async()=>{
  connections++;throw Error('database must not be used');
 }}});
 for(const value of [undefined,null,true,false,'45',0,-1,44,181,45.5,NaN,Infinity]){
  await assert.rejects(db.claimPublish('fixture',value),/^Error: PUBLISH_DELAY_INVALID$/);
 }
 assert.equal(connections,0);
});

test('both allowed delay boundaries retain empty-account behavior',async()=>{
 let connections=0;
 const db=new PodDB({bridge,expiresAt:'2099-01-01T00:00:00Z',pool:{connect:async()=>{
  connections++;return {query:async()=>({rows:[]}),release(){}};
 }}});
 for(const delay of [45,180])assert.equal(await db.claimPublish('missing-account',delay),null);
 assert.equal(connections,2);
});
