import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {financialTotals,recordFinancialEvent} from '../integrations/pod/finance.mjs';

const key='synthetic-finance-replay-key-'.repeat(2);
const event=()=>({verified:true,authority_event_id:'mf-event',provider_event_id:'provider-event',provider:'redbubble',
 job_id:'fixture-job',amount_minor:1234,kind:'royalty',currency:'USD',occurred_at:'2026-01-01T00:00:00Z',evidence_sha256:'a'.repeat(64)});
const sign=value=>{const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:finance',
 issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};

test('financial totals reject executable or unbounded query results without invocation',async()=>{
 const valid={currency:'USD',verified_net_recorded_minor:'125',evidence_count:'2'};let reads=0;
 const resultProxy=value=>new Proxy(value,{get(target,property,receiver){
  if(property==='then')return undefined;reads++;return Reflect.get(target,property,receiver);
 }});
 const sparse=[];sparse.length=1;
 const attempts=[
  Object.defineProperty({},'rows',{get(){reads++;throw Error('FINANCIAL_TOTAL_ROWS_GETTER_EXECUTED');}}),
  resultProxy({rows:[valid]}),
  {rows:new Proxy([valid],{get(target,property,receiver){reads++;return Reflect.get(target,property,receiver);}})},
  {rows:sparse},
  {rows:Object.defineProperty([],'0',{enumerable:true,get(){reads++;throw Error('FINANCIAL_TOTAL_ROW_GETTER_EXECUTED');}})},
  {rows:[new Proxy(valid,{get(target,property,receiver){reads++;return Reflect.get(target,property,receiver);}})]},
  {rows:[Object.defineProperty({...valid},'currency',{enumerable:true,get(){reads++;throw Error('FINANCIAL_TOTAL_FIELD_GETTER_EXECUTED');}})]},
  {rows:new Array(26**3+1)},
  {rows:[{...valid,evidence_count:'0'}]},
  {rows:[valid,{...valid}]},
 ];
 for(const result of attempts){
  const db={read:async()=>result};
  await assert.rejects(financialTotals(db),/^Error: FINANCIAL_QUERY_UNVERIFIED$/);
 }
 assert.equal(reads,0);
});
test('financial totals return frozen scalar snapshots detached from driver-owned rows',async()=>{
 const row={currency:'USD',verified_net_recorded_minor:'9007199254740993',evidence_count:'2'},rows=[row];
 const result=await financialTotals({read:async()=>({rows})});
 assert.deepEqual(result,[row]);assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result[0]),true);
 row.currency='EUR';rows.push({currency:'CAD',verified_net_recorded_minor:'1',evidence_count:'1'});
 assert.deepEqual(result,[{currency:'USD',verified_net_recorded_minor:'9007199254740993',evidence_count:'2'}]);
});
function fixture(previous=[],corrupt=false){
 const rows=previous.map(x=>({...x})),outbox=[];
 const result=value=>Object.assign(Object.create({driver_result:true}),value);
 const db={active(){},tx:async fn=>{
  const size=rows.length,events=outbox.length;
  try{return await fn({query:async(sql,args)=>{
   if(sql.includes('FROM pod_artifacts'))return {rows:args[0].map(sha=>({sha256:sha,media_type:'application/json',body_sha256:corrupt?'0'.repeat(64):sha}))};
   if(sql.startsWith('INSERT INTO pod_financial_events')){
    const [id,job_id,provider,provider_event_id,kind,amount_minor,currency,occurred_at,evidence_sha256,authority_event_id]=args;
    const conflict=rows.some(r=>r.provider===provider&&r.provider_event_id===provider_event_id);
    const authorityConflict=rows.some(r=>r.authority_event_id===authority_event_id);
    if(conflict||(authorityConflict&&sql.includes('ON CONFLICT DO NOTHING')))return result({rowCount:0,rows:[]});
    // The old targeted conflict handler had no upstream-identity uniqueness.
    // Model that path too so the regression exposes the actual double count.
    rows.push({id,job_id,provider,provider_event_id,kind,amount_minor,currency,occurred_at,evidence_sha256,authority_event_id});
    return result({rowCount:1,rows:[{id}]});
   }
   if(sql.includes('FROM pod_financial_events'))return result({rows:rows.filter(r=>(r.provider===args[0]&&r.provider_event_id===args[1])||(args[2]&&r.authority_event_id===args[2])).map(r=>({...r,occurred_at_matches:new Date(r.occurred_at).getTime()===Date.parse(args[3])}))});
   if(sql.startsWith('INSERT INTO pod_events')){outbox.push(args);return {rowCount:1,rows:[{id:args[0],job_id:args[1],kind:args[2]}]};}
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
test('corrupt statement bytes cannot create or acknowledge a financial event',async()=>{
 for(const replay of [false,true]){
  const e=event(),f=fixture(replay?[{...e,id:'existing'}]:[],true);
  await assert.rejects(recordFinancialEvent(f.db,sign(e),key),/EVIDENCE_ARTIFACT_CORRUPT/);
  assert.equal(f.rows.length,replay?1:0);assert.equal(f.outbox.length,0);
 }
});
test('financial intake rejects executable stored-evidence query results without invocation',async()=>{
 const sha=event().evidence_sha256;let reads=0,writes=0;
 const valid={sha256:sha,media_type:'application/json',body_sha256:sha};
 const attempts=[
  Object.defineProperty({},'rows',{get(){reads++;throw Error('evidence rows getter executed');}}),
  new Proxy({rows:[valid]},{get(target,property,receiver){
   if(property==='then')return undefined;reads++;return Reflect.get(target,property,receiver);
  }}),
  {rows:new Proxy([valid],{get(target,property,receiver){reads++;return Reflect.get(target,property,receiver);}})},
  {rows:Object.defineProperty([],'0',{enumerable:true,get(){reads++;throw Error('evidence row getter executed');}})},
  {rows:[new Proxy(valid,{get(target,property,receiver){reads++;return Reflect.get(target,property,receiver);}})]},
  {rows:[Object.defineProperty({...valid},'sha256',{enumerable:true,get(){reads++;throw Error('evidence field getter executed');}})]},
 ];
 for(const result of attempts){
  const db={active(){},tx:fn=>fn({query:async sql=>{
   if(sql.includes('FROM pod_artifacts'))return result;
   writes++;assert.fail('unverified evidence result reached financial mutation');
  }})};
  await assert.rejects(recordFinancialEvent(db,sign(event()),key),/^Error: EVIDENCE_QUERY_UNVERIFIED$/);
 }
 assert.equal(reads,0);assert.equal(writes,0);
});
test('financial intake rejects executable ledger query results without invocation',async()=>{
 const e=event(),validEvidence={rows:[{sha256:e.evidence_sha256,media_type:'application/json',body_sha256:e.evidence_sha256}]};
 let reads=0;
 const resultProxy=value=>new Proxy(value,{get(target,property,receiver){
  if(property==='then')return undefined;reads++;return Reflect.get(target,property,receiver);
 }});
 const insertAttempts=[
  Object.defineProperty({},'rowCount',{get(){reads++;throw Error('rowCount getter executed');}}),
  resultProxy({rowCount:1,rows:[]}),
 ];
 const replayRow={id:'original',...e,occurred_at_matches:true};
 const replayAttempts=[
  Object.defineProperty({},'rows',{get(){reads++;throw Error('replay rows getter executed');}}),
  resultProxy({rows:[replayRow]}),
  {rows:new Proxy([replayRow],{get(target,property,receiver){reads++;return Reflect.get(target,property,receiver);}})},
  {rows:Object.defineProperty([],'0',{enumerable:true,get(){reads++;throw Error('replay row getter executed');}})},
  {rows:[new Proxy(replayRow,{get(target,property,receiver){reads++;return Reflect.get(target,property,receiver);}})]},
  {rows:[Object.defineProperty({...replayRow},'id',{enumerable:true,get(){reads++;throw Error('replay field getter executed');}})]},
 ];
 for(const [stage,attempt] of [...insertAttempts.map(value=>['insert',value]),...replayAttempts.map(value=>['replay',value])]){
  let ledgerWrites=0,outboxWrites=0,rolledBack=false;
  const db={active(){},tx:async fn=>{
   try{return await fn({query:async sql=>{
    if(sql.includes('FROM pod_artifacts'))return validEvidence;
    if(sql.startsWith('INSERT INTO pod_financial_events')){ledgerWrites++;return stage==='insert'?attempt:{rowCount:0,rows:[]};}
    if(sql.includes('FROM pod_financial_events'))return attempt;
    if(sql.startsWith('INSERT INTO pod_events')){outboxWrites++;return {rowCount:1,rows:[]};}
    assert.fail('unexpected financial query');
   }});}catch(error){rolledBack=true;throw error;}
  }};
  await assert.rejects(recordFinancialEvent(db,sign(e),key),/^Error: FINANCIAL_QUERY_UNVERIFIED$/);
  assert.equal(ledgerWrites,1);assert.equal(outboxWrites,0);assert.equal(rolledBack,true);
 }
 assert.equal(reads,0);
});
test('financial intake rejects unverified audit event mutations and rolls back the ledger',async()=>{
 const e=event(),validEvidence={rows:[{sha256:e.evidence_sha256,media_type:'application/json',body_sha256:e.evidence_sha256}]};
 let reads=0;
 const resultProxy=value=>new Proxy(value,{get(target,property,receiver){
  if(property==='then')return undefined;reads++;return Reflect.get(target,property,receiver);
 }});
 const attempts=[
  ()=>Object.defineProperty({},'rowCount',{get(){reads++;throw Error('audit rowCount getter executed');}}),
  id=>resultProxy({rowCount:1,rows:[{id,job_id:e.job_id,kind:'pod.finance.verified'}]}),
  ()=>({rowCount:0,rows:[]}),
  ()=>({rowCount:1,rows:[]}),
  ()=>({rowCount:1,rows:[{id:'wrong',job_id:e.job_id,kind:'pod.finance.verified'}]}),
  id=>({rowCount:1,rows:[{id,job_id:'wrong',kind:'pod.finance.verified'}]}),
  id=>({rowCount:1,rows:[{id,job_id:e.job_id,kind:'wrong'}]}),
 ];
 for(const attempt of attempts){
  let ledgerWrites=0,auditWrites=0,rolledBack=false;
  const db={active(){},tx:async fn=>{
   try{return await fn({query:async(sql,args)=>{
    if(sql.includes('FROM pod_artifacts'))return validEvidence;
    if(sql.startsWith('INSERT INTO pod_financial_events')){ledgerWrites++;return {rowCount:1,rows:[{id:args[0]}]};}
    if(sql.startsWith('INSERT INTO pod_events')){
     auditWrites++;return attempt(args[0]);
    }
    assert.fail('unexpected financial query');
   }});}catch(error){rolledBack=true;throw error;}
  }};
  await assert.rejects(recordFinancialEvent(db,sign(e),key),/^Error: FINANCIAL_QUERY_UNVERIFIED$/);
  assert.equal(ledgerWrites,1);assert.equal(auditWrites,1);assert.equal(rolledBack,true);
 }
 assert.equal(reads,0);
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
test('financial identities reject NUL and lossy UTF-16 before database access',async()=>{
 for(const field of ['authority_event_id','provider_event_id','provider','job_id'])
  for(const value of ['identity\0suffix','\ud800','\ud801']){
   const db={tx:()=>assert.fail('lossy financial identity reached database')};
   await assert.rejects(recordFinancialEvent(db,sign({...event(),[field]:value}),key),/FINANCIAL_EVIDENCE_REQUIRED/);
  }
});
test('valid opaque financial identities retain exact case, spacing and Unicode',async()=>{
 const e={...event(),authority_event_id:' MF-É😀 ',provider_event_id:' Provider-ß😀 ',
  provider:' RedBubble ',job_id:' Job-É😀 '};
 const f=fixture(),r=await recordFinancialEvent(f.db,sign(e),key);
 assert.equal(r.duplicate,false);
 for(const field of ['authority_event_id','provider_event_id','provider','job_id'])
  assert.equal(f.rows[0][field],e[field]);
});
test('new scoped event is recorded once with one outbox observation',async()=>{
 const f=fixture(),r=await recordFinancialEvent(f.db,sign(event()),key);
 assert.equal(r.duplicate,false);assert.equal(f.rows.length,1);assert.equal(f.outbox.length,1);
 assert.deepEqual(await recordFinancialEvent(f.db,sign(event()),key),{id:r.id,duplicate:true});
 assert.equal(f.rows.length,1);assert.equal(f.outbox.length,1);
});

test('database timestamp mismatch cannot be hidden by millisecond Date decoding',async()=>{
 for(const occurred_at_matches of [false,null,undefined]){
  const e={...event(),occurred_at:'2026-01-01T00:00:00.123457Z'};
  const db={active(){},tx:async fn=>fn({query:async sql=>{
   if(sql.includes('FROM pod_artifacts'))return {rows:[{sha256:e.evidence_sha256,media_type:'application/json',body_sha256:e.evidence_sha256}]};
   if(sql.startsWith('INSERT INTO pod_financial_events'))return {rowCount:0};
   if(sql.includes('FROM pod_financial_events'))return {rows:[{...e,id:'original',occurred_at:new Date('2026-01-01T00:00:00.123456Z'),occurred_at_matches}]};
   assert.fail('replay must not write an outbox event');
  }})};
  await assert.rejects(recordFinancialEvent(db,sign(e),key),/FINANCIAL_REPLAY_CONFLICT/);
 }
});

test('ambiguous, invalid or overprecision financial timestamps fail before database access',async()=>{
 for(const occurred_at of ['2026-01-01','2026-01-01T00:00:00','2026-01-01T00:00:00.1234567Z',
  '2026-02-30T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:00:00+24:00']){
  await assert.rejects(recordFinancialEvent({tx:()=>assert.fail('invalid timestamp reached database')},sign({...event(),occurred_at}),key),/FINANCIAL_EVIDENCE_REQUIRED/);
 }
});

