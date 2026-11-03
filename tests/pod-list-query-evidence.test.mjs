import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};

function database(result){
 const client={release(){},query:async query=>{
  const text=typeof query==='string'?query:query.text;
  return text.startsWith('SELECT ')?result:{rows:[]};
 }};
 return new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
}

test('release-ready listing rejects accessor-backed result rows without invoking them',async()=>{
 let reads=0;
 const result={};
 Object.defineProperty(result,'rows',{enumerable:true,get(){reads++;return [];}});
 await assert.rejects(database(result).listReady(),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});

test('release-ready listing rejects accessor-backed row fields without invoking them',async()=>{
 let reads=0;
 const row={platform:'redbubble',state:'qa_passed'};
 Object.defineProperty(row,'id',{enumerable:true,get(){reads++;return 'fixture-job';}});
 await assert.rejects(database({rows:[row]}).listReady(),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});

test('operations listing rejects accessor-backed result rows without invoking them',async()=>{
 let reads=0;
 const result={};
 Object.defineProperty(result,'rows',{enumerable:true,get(){reads++;return [];}});
 await assert.rejects(database(result).listOperationsJobs(),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});

test('operations listing rejects accessor-backed manifest evidence without invoking it',async()=>{
 let reads=0;
 const row={id:'fixture-job',platform:'redbubble',state:'review_required',reason_code:'REVIEW_REQUIRED',
  attempt:1,created_at:new Date(0),manifest_sha256:'a'.repeat(64),can_preview:true};
 Object.defineProperty(row,'manifest',{enumerable:true,get(){reads++;return {};}});
 await assert.rejects(database({rows:[row]}).listOperationsJobs(),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});
