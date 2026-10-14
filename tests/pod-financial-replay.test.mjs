import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';

const key='synthetic-finance-replay-key-'.repeat(2);
const event=()=>({verified:true,authority_event_id:'mf-event',provider_event_id:'provider-event',provider:'redbubble',
 job_id:'fixture-job',amount_minor:1234,kind:'royalty',currency:'USD',occurred_at:'2026-01-01T00:00:00Z',evidence_sha256:'a'.repeat(64)});
const sign=value=>{const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:finance',
 issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
function fixture(previous=[]){
 const rows=previous.map(x=>({...x})),outbox=[];
 const db={tx:async fn=>{
  const size=rows.length,events=outbox.length;
  try{return await fn({query:async(sql,args)=>{
   if(sql.startsWith('INSERT INTO pod_financial_events')){
    const [id,job_id,provider,provider_event_id,kind,amount_minor,currency,occurred_at,evidence_sha256,authority_event_id]=args;
    const conflict=rows.some(r=>r.provider===provider&&r.provider_event_id===provider_event_id);
    const authorityConflict=rows.some(r=>r.authority_event_id===authority_event_id);
    if(conflict||(authorityConflict&&sql.includes('ON CONFLICT DO NOTHING')))return {rowCount:0,rows:[]};
    // The old targeted conflict handler had no upstream-identity uniqueness.
    // Model that path too so the regression exposes the actual double count.
    rows.push({id,job_id,provider,provider_event_id,kind,amount_minor,currency,occurred_at,evidence_sha256,authority_event_id});
    return {rowCount:1,rows:[{id}]};
   }
   if(sql.startsWith('SELECT * FROM pod_financial_events'))return {rows:rows.filter(r=>(r.provider===args[0]&&r.provider_event_id===args[1])||(args[2]&&r.authority_event_id===args[2]))};
   if(sql.startsWith('INSERT INTO pod_events')){outbox.push(args);return {rowCount:1,rows:[]};}
   throw Error('UNEXPECTED_QUERY');
  }});}catch(e){rows.length=size;outbox.length=events;throw e;}
 }};
 return {db,rows,outbox};
}
test('one authority event cannot be reattributed to a new provider event',async()=>{
 const e=event(),f=fixture([{...e,id:'original'}]);
 await assert.rejects(recordFinancialEvent(f.db,sign({...e,provider_event_id:'different'}),key),/FINANCIAL_REPLAY_CONFLICT/);
 assert.equal(f.rows.length,1);assert.equal(f.outbox.length,0);
});
test('one authority event cannot cross provider or job boundaries',async()=>{
 for(const change of [{provider:'teepublic',provider_event_id:'different'},{job_id:'other-job',provider_event_id:'different'}]){
  const e=event(),f=fixture([{...e,id:'original'}]);
  await assert.rejects(recordFinancialEvent(f.db,sign({...e,...change}),key),/FINANCIAL_REPLAY_CONFLICT/);
 }
});
test('provider replay cannot change the upstream authority identity',async()=>{
 const e=event(),f=fixture([{...e,id:'original'}]);
 await assert.rejects(recordFinancialEvent(f.db,sign({...e,authority_event_id:'different'}),key),/FINANCIAL_REPLAY_CONFLICT/);
});
test('exact refreshed replay returns its immutable ID without another outbox event',async()=>{
 const e=event(),f=fixture([{...e,id:'original',amount_minor:'1234',occurred_at:new Date(e.occurred_at)}]);
 assert.deepEqual(await recordFinancialEvent(f.db,sign(e),key),{id:'original',duplicate:true});
 assert.equal(f.outbox.length,0);
});
test('PostgreSQL Date values preserve milliseconds on exact replay',async()=>{
 const e={...event(),occurred_at:'2026-01-01T00:00:00.123Z'};
 const f=fixture([{...e,id:'millisecond-event',occurred_at:new Date(e.occurred_at)}]);
 assert.deepEqual(await recordFinancialEvent(f.db,sign(e),key),{id:'millisecond-event',duplicate:true});
});
test('conflict on two distinct identities fails closed instead of selecting either',async()=>{
 const e=event(),f=fixture([{...e,id:'one',authority_event_id:'other-authority'},
  {...e,id:'two',provider_event_id:'other-provider-event'}]);
 await assert.rejects(recordFinancialEvent(f.db,sign(e),key),/FINANCIAL_REPLAY_CONFLICT/);
});
test('financial identities require nonblank strings and occurrence cannot be future',async()=>{
 for(const change of [{authority_event_id:[]},{provider_event_id:{}},{provider:' '},{job_id:true},
  {occurred_at:new Date(Date.now()+86400000).toISOString()}]){
  const f=fixture();await assert.rejects(recordFinancialEvent(f.db,sign({...event(),...change}),key),/FINANCIAL_EVIDENCE_REQUIRED/);
  assert.equal(f.rows.length,0);assert.equal(f.outbox.length,0);
 }
});
test('new scoped event is recorded once with one outbox observation',async()=>{
 const f=fixture(),r=await recordFinancialEvent(f.db,sign(event()),key);
 assert.equal(r.duplicate,false);assert.equal(f.rows.length,1);assert.equal(f.outbox.length,1);
 assert.deepEqual(await recordFinancialEvent(f.db,sign(event()),key),{id:r.id,duplicate:true});
 assert.equal(f.rows.length,1);assert.equal(f.outbox.length,1);
});
