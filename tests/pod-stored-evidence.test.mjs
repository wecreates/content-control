import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStoredEvidence} from '../integrations/pod/stored-evidence.mjs';
import {ARTIFACT_MEDIA_TYPES} from '../integrations/pod/artifacts.mjs';
const sha='a'.repeat(64);
test('proof validation rejects unbounded or malformed requests before SQL',async()=>{
 for(const hashes of [null,[],[null],['bad'],Array(33).fill(sha)]){
  await assert.rejects(assertStoredEvidence({query(){assert.fail('must not query');}},hashes),/EVIDENCE_ARTIFACT_INVALID/);
 }
});
test('proof validation deduplicates requested hashes and preserves missing-proof errors',async()=>{
 await assertStoredEvidence({query:async(sql,args)=>{
  assert.deepEqual(args,[[sha],ARTIFACT_MEDIA_TYPES]);assert.match(sql,/CASE WHEN media_type=ANY\(\$2::text\[\]\)/);
  return {rows:[{sha256:sha,media_type:'application/json',body_sha256:sha}]};
 }},[sha,sha]);
 await assert.rejects(assertStoredEvidence({query:async()=>({rows:[]})},[sha],'MARKET_EVIDENCE_MISSING'),/MARKET_EVIDENCE_MISSING/);
});
test('proof validation rejects unsupported stored media even from an alternate pool',async()=>{
 await assert.rejects(assertStoredEvidence({query:async()=>({rows:[{
  sha256:sha,media_type:'text/html',body_sha256:null
 }]})},[sha]),/^Error: EVIDENCE_ARTIFACT_MEDIA_INVALID$/);
});
