import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',
 contract:{fail_closed_rules:BRIDGE_RULES}};
const validRow={id:'job',account_id:'account',platform:'kdp',fencing_token:'2',attempt:2,
 brief:{id:'job',facts:{title:'Bounded fixture'}},state:'processing'};

function fixture(result){
 const queries=[];
 const db=new PodDB({bridge,expiresAt:'2099-01-01T00:00:00Z'});
 db.tx=async fn=>fn({query:async sql=>{queries.push(sql);return result;}});
 return {db,queries};
}

test('production claim returns a data-only snapshot from exact mutation evidence',async()=>{
 const source={...validRow,brief:{...validRow.brief,facts:{...validRow.brief.facts}}};
 const {db,queries}=fixture({rowCount:1,rows:[source]});
 const claim=await db.claimProduction();
 assert.deepEqual(claim,{id:'job',account_id:'account',platform:'kdp',fencing_token:'2',attempt:2,
  brief:{id:'job',facts:{title:'Bounded fixture'}}});
 assert.notEqual(claim,source);assert.notEqual(claim.brief,source.brief);
 source.brief.facts.title='retained mutation';
 assert.equal(claim.brief.facts.title,'Bounded fixture');
 assert.equal(queries.length,1);
 assert.match(queries[0],/RETURNING id,account_id,platform,fencing_token::text AS fencing_token,attempt,brief,state/);
 assert.doesNotMatch(queries[0],/RETURNING \*/);
});

test('production claim accepts only an exact empty mutation receipt',async()=>{
 assert.equal(await fixture({rowCount:0,rows:[]}).db.claimProduction(),null);
});

test('production claim rejects malformed or mismatched mutation evidence',async()=>{
 const sparse=[];sparse.length=1;
 const extraRows=[validRow];extraRows.extra=true;
 const accessorRow={...validRow};
 Object.defineProperty(accessorRow,'state',{enumerable:true,get(){throw Error('row getter executed');}});
 const proxyRow=new Proxy(validRow,{get(){throw Error('row proxy trap executed');}});
 const proxyRows=new Proxy([validRow],{get(){throw Error('rows proxy trap executed');}});
 const badBrief={id:'job'};
 Object.defineProperty(badBrief,'facts',{enumerable:true,get(){throw Error('brief getter executed');}});
 const attempts=[
  undefined,{},
  {rowCount:0,rows:[validRow]},
  {rowCount:1,rows:[]},
  {rowCount:1,rows:sparse},
  {rowCount:1,rows:extraRows},
  {rowCount:1,rows:proxyRows},
  {rowCount:1,rows:[proxyRow]},
  {rowCount:1,rows:[accessorRow]},
  {rowCount:1,rows:[{...validRow,extra:true}]},
  {rowCount:1,rows:[{...validRow,state:'raw'}]},
  {rowCount:1,rows:[{...validRow,id:''}]},
  {rowCount:1,rows:[{...validRow,account_id:' '}]},
  {rowCount:1,rows:[{...validRow,platform:'etsy'}]},
  {rowCount:1,rows:[{...validRow,fencing_token:2}]},
  {rowCount:1,rows:[{...validRow,fencing_token:'9223372036854775808'}]},
  {rowCount:1,rows:[{...validRow,attempt:0}]},
  {rowCount:1,rows:[{...validRow,brief:badBrief}]},
  Object.defineProperty({},'rowCount',{get(){throw Error('result getter executed');}}),
  new Proxy({rowCount:0,rows:[]},{get(target,key){
   if(key==='then')return undefined;
   throw Error('result proxy trap executed');
  }}),
 ];
 for(const attempt of attempts)
  await assert.rejects(fixture(attempt).db.claimProduction(),/^Error: POD_MUTATION_UNVERIFIED$/);
});
