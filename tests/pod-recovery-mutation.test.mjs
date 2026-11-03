import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const outcomes=[
 {state:'ambiguous',reason_code:'LEASE_EXPIRED'},
 {state:'blocked',reason_code:'PRODUCTION_LEASE_EXPIRED'},
];

function result(outcome,ids=[]){
 return {rowCount:ids.length,rows:ids.map(id=>({id,...outcome}))};
}
function fixture(results){
 const queries=[];
 const db=new PodDB({bridge,expiresAt:'2099-01-01T00:00:00Z'});
 db.tx=async fn=>fn({query:async sql=>{
  queries.push(sql);
  const value=results[queries.length-1];
  if(value instanceof Error)throw value;
  return value;
 }});
 return {db,queries};
}

test('lease recovery accepts exact bounded mutation receipts',async()=>{
 const first=result(outcomes[0],['publishing-job']);
 const second=result(outcomes[1],['processing-job']);
 const {db,queries}=fixture([first,second]);
 assert.equal(await db.recover(),undefined);
 assert.equal(queries.length,2);
 for(const sql of queries){
  assert.match(sql,/FOR UPDATE SKIP LOCKED/);
  assert.match(sql,/LIMIT 100/);
  assert.match(sql,/RETURNING q\.id,q\.state,q\.reason_code/);
 }
});

test('lease recovery accepts exact empty mutation receipts',async()=>{
 const {db}=fixture(outcomes.map(outcome=>result(outcome)));
 assert.equal(await db.recover(),undefined);
});

test('lease recovery rejects malformed or mismatched mutation receipts',async()=>{
 const proxyRows=new Proxy([],{get(){throw Error('rows proxy trap executed');}});
 const proxyRow=new Proxy({id:'job',...outcomes[0]},{get(){throw Error('row proxy trap executed');}});
 const sparse=[];sparse.length=1;
 const extraRows=[{id:'job',...outcomes[0]}];extraRows.extra=true;
 const accessorRow={id:'job',reason_code:outcomes[0].reason_code};
 Object.defineProperty(accessorRow,'state',{enumerable:true,get(){throw Error('row getter executed');}});
 const attempts=[
  undefined,{},
  {rowCount:0,rows:[{id:'job',...outcomes[0]}]},
  {rowCount:1,rows:[]},
  {rowCount:1,rows:sparse},
  {rowCount:1,rows:extraRows},
  {rowCount:1,rows:proxyRows},
  {rowCount:1,rows:[proxyRow]},
  {rowCount:1,rows:[accessorRow]},
  {rowCount:1,rows:[{id:'',...outcomes[0]}]},
  {rowCount:1,rows:[{id:'job',...outcomes[0],extra:true}]},
  {rowCount:1,rows:[{id:'job',state:'blocked',reason_code:'LEASE_EXPIRED'}]},
  {rowCount:2,rows:[{id:'same',...outcomes[0]},{id:'same',...outcomes[0]}]},
  {rowCount:101,rows:Array.from({length:101},(_,index)=>({id:`job-${index}`,...outcomes[0]}))},
  Object.defineProperty({},'rowCount',{get(){throw Error('result getter executed');}}),
  // Promise assimilation reads `then` once before recover() receives a query
  // result. Permit only that language-level read; the verifier must not invoke
  // any application data trap on the Proxy.
  new Proxy({rowCount:0,rows:[]},{get(target,key){
   if(key==='then')return undefined;
   throw Error('result proxy trap executed');
  }}),
 ];
 for(const [stage,outcome] of outcomes.entries())for(const attempt of attempts){
  const valid=outcomes.map((expected,index)=>result(expected,index===stage?['valid-other-stage']:[]));
  valid[stage]=attempt;
  await assert.rejects(fixture(valid).db.recover(),/^Error: POD_MUTATION_UNVERIFIED$/);
 }
});

test('lease recovery rejects one identity appearing in both transition batches',async()=>{
 const {db}=fixture(outcomes.map(outcome=>result(outcome,['same-job'])));
 await assert.rejects(db.recover(),/^Error: POD_MUTATION_UNVERIFIED$/);
});
