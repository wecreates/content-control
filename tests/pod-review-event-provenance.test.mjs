import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};

test('review retrieval selects manifest identity only from the review-hold event',async()=>{
 const queries=[];
 const client={release(){},query:async sql=>{queries.push(typeof sql==='string'?sql:sql.text);return {rows:[]};}};
 const pool={connect:async()=>client};
 const db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});

 await assert.rejects(db.reviewPackage('fixture-job'),/PACKAGE_UNAVAILABLE/);
 await assert.rejects(db.reviewArtifact('fixture-job','a'.repeat(64)),/ARTIFACT_UNAVAILABLE/);
 const retrievals=queries.filter(sql=>sql.includes("e.kind='pod.production.review_required'"));
 assert.equal(retrievals.length,2);
 for(const sql of retrievals)assert.match(sql,/e\.kind='pod\.production\.review_required'/);
});
