import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {enforceBrief,verifyEnvelope} from '../integrations/pod/policy.mjs';

const key='synthetic-claim-key-'.repeat(3),now=1000;
const job={id:'job',account_id:'account',business_id:'business',platform:'kdp',destination_platform:'kdp',mode:'PRELAUNCH'};
const fact=(evidence_ids=['event'])=>({value:'Fixture claim',verified:true,evidence_ids});
function brief(fields={}){
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:now,expires_at_ms:now+60000,
  job_id:job.id,account_id:job.account_id,business_id:job.business_id,platform:job.platform,max_mode:'PRELAUNCH',
  production_permission:true,publication_permission:false,revoked:false,...fields});
 const envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
 return enforceBrief(verifyEnvelope(envelope,key,'content-control:pod',now),job);
}

test('signed claim evidence must contain bounded nonblank primitive references',()=>{
 for(const ref of [null,false,0,[],{},['event'],'',' \t\n','identity\0suffix','\ud800','\ud801','x'.repeat(257)]){
  assert.deepEqual(brief({verified_facts:{title:fact([ref])}}).facts,{},JSON.stringify(ref));
  assert.deepEqual(brief({verified_facts:{title:fact(['valid',ref])}}).facts,{});
 }
 for(const refs of [[],['event','event'],Array.from({length:33},(_,i)=>'event-'+i)]){
  assert.deepEqual(brief({verified_facts:{title:fact(refs)}}).facts,{});
 }
});
test('a fact collection must be an object and empty claims are omitted',()=>{
 assert.deepEqual(brief({verified_facts:[fact()]}).facts,{});
 for(const value of ['', ' \n\t'])assert.deepEqual(brief({verified_facts:{title:{...fact(),value}}}).facts,{});
 for(const name of ['', 'identity\0suffix','\ud800','\ud801'])
  assert.deepEqual(brief({verified_facts:{[name]:fact()}}).facts,{});
});
test('malformed references cannot support shipping or financial claims even with authority flags',()=>{
 for(const name of ['shipping','safety','warranty','revenue','profit']){
  const value={...fact([null]),provider_verified:true,money_factory_event_verified:true};
  assert.deepEqual(brief({verified_facts:{[name]:value}}).facts,{});
 }
});
test('verified prices require an exact currency and a valid evidence reference',()=>{
 const price={verified:true,amount_minor:100,currency:'USD',evidence_id:'price-event'};
 for(const evidence_id of [null,false,1,[],{},['event'],'',' \n','identity\0suffix','\ud800','\ud801','x'.repeat(257)])
  assert.equal(brief({price:{...price,evidence_id}}).price,null);
 for(const currency of [['USD'],{},'USD\n','USD\r','usd','US','USDD'])
  assert.equal(brief({price:{...price,currency}}).price,null);
});
test('valid evidence is preserved exactly while provider and forbidden-claim gates remain active',()=>{
 const refs=['é'.repeat(256),...Array.from({length:31},(_,i)=>'event-'+i)];
 const title={...fact(refs),value:'Café 雪'};
 const shipping={...fact(),provider_verified:true},profit={...fact(),money_factory_event_verified:true};
 const price={verified:true,amount_minor:0,currency:'USD',evidence_id:'é'.repeat(256)};
 const result=brief({verified_facts:{title,shipping,profit,safety:fact(),revenue:fact()},price});
 assert.deepEqual(result.facts,{title,shipping,profit});assert.deepEqual(result.price,price);
 assert.deepEqual(brief({verified_facts:{title,shipping,profit},forbidden_claims:['title','Fixture claim']}).facts,{});
 assert.deepEqual(brief({verified_facts:{title:{...title,verified:false}}}).facts,{});
 assert.equal(brief({price:{...price,verified:false}}).price,null);
});
