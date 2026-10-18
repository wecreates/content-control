import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {validEvidenceTime} from '../integrations/pod/evidence-time.mjs';
import {recordMarketObservation} from '../integrations/pod/market.mjs';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';
import {validateTemplate,validateInteriorTemplate} from '../integrations/pod/templates.mjs';

const now=Date.parse('2026-01-01T00:00:00.123Z');
const key='synthetic-evidence-clock-key-'.repeat(2);
const sign=(audience,value)=>{
 const payload=JSON.stringify({schema_version:1,audience,issued_at_ms:now-1,expires_at_ms:now+60000,...value});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
};
const future=['2026-01-01T00:00:00.123001Z','2026-01-01T00:00:00.123999Z',
 '2026-01-01T05:30:00.123001+05:30','2025-12-31T17:00:00.123001-07:00'];
const template=(observed_at,platform='redbubble')=>({product:'fixture',country:'US',official_source_verified:true,
 source_url:'https://example.org/synthetic-template',source_sha256:'a'.repeat(64),observed_at,
 template:{platform,dpi:300,size_inches:[2,2],safe_box_px:[0,0,600,600]}});

test('one to 999 microseconds beyond the clock cannot be truncated into the present',()=>{
 for(const value of future)assert.equal(validEvidenceTime(value,now),false,value);
});
test('exact millisecond boundaries and earlier microseconds retain equivalent offsets',()=>{
 for(const value of ['2026-01-01T00:00:00.123Z','2026-01-01T00:00:00.123000Z',
  '2026-01-01T00:00:00.122999Z','2026-01-01T05:30:00.123000+05:30',
  '2025-12-31T17:00:00.123000-07:00'])assert.equal(validEvidenceTime(value,now),true,value);
});
test('fractional precision scales correctly and the epoch boundary is exact',()=>{
 for(const value of ['1970-01-01T00:00:00Z','1969-12-31T23:59:59.999999Z'])
  assert.equal(validEvidenceTime(value,0),true,value);
 assert.equal(validEvidenceTime('1970-01-01T00:00:00.000001Z',0),false);
 for(const fraction of ['1','10','100','1000','10000','100000'])
  assert.equal(validEvidenceTime('2026-01-01T00:00:00.'+fraction+'Z',now),true);
});
test('invalid validation clocks fail closed rather than bypass future checks',()=>{
 for(const clock of [NaN,Infinity,-Infinity,-1,now+.5,Number.MAX_SAFE_INTEGER+1,String(now),null])
  assert.equal(validEvidenceTime('2026-01-01T00:00:00Z',clock),false,String(clock));
});
test('signed future market evidence rejects before entering a transaction',async t=>{
 t.mock.method(Date,'now',()=>now);let transactions=0;
 const db={tx:async()=>{transactions++;throw Error('DATABASE_REACHED');}};
 for(const observed_at of future)await assert.rejects(recordMarketObservation(db,sign('content-control:pod:market',{
  platform:'redbubble',source_url:'https://example.org/synthetic-market',country:'US',category:'shirt',
  observed_at,source_sha256:'a'.repeat(64),collection_authorized:true}),key),/MARKET_EVIDENCE_INVALID/);
 assert.equal(transactions,0);
});
test('signed future financial evidence cannot enter a ledger transaction',async t=>{
 t.mock.method(Date,'now',()=>now);let transactions=0;
 const db={tx:async()=>{transactions++;throw Error('DATABASE_REACHED');}};
 for(const occurred_at of future)await assert.rejects(recordFinancialEvent(db,sign('content-control:pod:finance',{
  verified:true,authority_event_id:'fixture-authority',provider_event_id:'fixture-event',provider:'redbubble',job_id:'fixture-job',
  amount_minor:100,kind:'royalty',currency:'USD',occurred_at,evidence_sha256:'a'.repeat(64)}),key),/FINANCIAL_EVIDENCE_REQUIRED/);
 assert.equal(transactions,0);
});
test('cover and KDP interior templates reject sub-millisecond future provenance',()=>{
 for(const observed_at of future){
  assert.throws(()=>validateTemplate(sign('pod:template',template(observed_at)),key,
   {platform:'redbubble',product:'fixture',country:'US'},now),/TEMPLATE_PROVENANCE_REQUIRED/);
  assert.throws(()=>validateInteriorTemplate(sign('pod:interior-template',template(observed_at,'kdp')),key,
   {platform:'kdp',product:'fixture',country:'US'},now),/TEMPLATE_PROVENANCE_REQUIRED/);
 }
});
test('exact-boundary template provenance remains usable without timestamp rewriting',()=>{
 const value=template('2026-01-01T05:30:00.123000+05:30');
 assert.deepEqual(validateTemplate(sign('pod:template',value),key,
  {platform:'redbubble',product:'fixture',country:'US'},now),value.template);
});
