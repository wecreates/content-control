import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStoredEvidence} from '../integrations/pod/stored-evidence.mjs';
const sha='a'.repeat(64);
test('proof validation rejects unbounded or malformed requests before SQL',async()=>{
 for(const hashes of [null,[],[null],['bad'],Array(33).fill(sha)]){
  await assert.rejects(assertStoredEvidence({query(){assert.fail('must not query');}},hashes),/EVIDENCE_ARTIFACT_INVALID/);
 }
});
test('proof validation deduplicates requested hashes and preserves missing-proof errors',async()=>{
 await assertStoredEvidence({query:async(sql,args)=>{
  assert.deepEqual(args,[[sha]]);assert.match(sql,/encode\(sha256\(body\)/);
  return {rows:[{sha256:sha,body_sha256:sha}]};
 }},[sha,sha]);
 await assert.rejects(assertStoredEvidence({query:async()=>({rows:[]})},[sha],'MARKET_EVIDENCE_MISSING'),/MARKET_EVIDENCE_MISSING/);
});
