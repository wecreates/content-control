import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-repair-admission-key-'.repeat(2);
const jobId='fixture-job';

function signed(overrides={}){
 const now=Date.now();
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:now-1,
  expires_at_ms:now+60000,job_id:jobId,business_id:'fixture-business',account_id:'fixture-account',
  platform:'redbubble',revoked:false,max_mode:'PRELAUNCH',production_permission:true,
  publication_permission:false,...overrides});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
}

function fixture(){
 const db=new PodDB({bridge,upstreamKey:key,expiresAt:'2099-01-01T00:00:00Z'});
 let txCalls=0;
 db.tx=async()=>{txCalls+=1;throw Error('UNEXPECTED_DATABASE_ACCESS');};
 return {db,txCalls:()=>txCalls};
}

for(const requestedId of [undefined,null,1,{},'', '   ', 'x'.repeat(257), 'bad\0job', '\ud800', 'other-job']){
 test('repair target outside the signed grant fails before database access: '+String(requestedId),async()=>{
  const {db,txCalls}=fixture();
  await assert.rejects(db.requeueRepair(requestedId,signed()),/GRANT_SCOPE_MISMATCH/);
  assert.equal(txCalls(),0);
 });
}

test('matching malformed signed and requested repair targets fail before database access',async()=>{
 const {db,txCalls}=fixture();
 await assert.rejects(db.requeueRepair('   ',signed({job_id:'   '})),/GRANT_SCOPE_MISMATCH/);
 assert.equal(txCalls(),0);
});

test('authentication remains ahead of repair target validation',async()=>{
 const {db,txCalls}=fixture();
 const upstream=signed();upstream.signature='0'.repeat(64);
 await assert.rejects(db.requeueRepair(null,upstream),/SIGNATURE_INVALID/);
 assert.equal(txCalls(),0);
});

test('the exact signed repair target reaches the database boundary unchanged',async()=>{
 const {db,txCalls}=fixture();
 await assert.rejects(db.requeueRepair(jobId,signed()),/UNEXPECTED_DATABASE_ACCESS/);
 assert.equal(txCalls(),1);
});

test('repair requeue rejects unverified archive and queue mutation receipts',async()=>{
 const attempts=[
  undefined,{},
  {rowCount:0,rows:[]},
  {rowCount:1,rows:[]},
  {rowCount:1,rows:[{id:'wrong',job_id:jobId,kind:'pod.repair.archived'}]},
  Object.defineProperty({},'rowCount',{get(){throw Error('repair mutation rowCount getter executed');}}),
  {rowCount:1,rows:new Proxy([],{get(){throw Error('repair mutation rows proxy executed');}})},
 ];
 for(const stage of ['archive','queue'])for(const attempt of attempts){
  let writes=0;
  const db=new PodDB({bridge,upstreamKey:key,expiresAt:'2099-01-01T00:00:00Z'});
  db.tx=fn=>fn({query:async(sql,args)=>{
   if(sql.startsWith('SELECT'))return {rows:[{id:jobId,brief:{id:jobId,business_id:'fixture-business',
    account_id:'fixture-account',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'},
    attempt:1,manifest:{},qa_envelope:{},reason_code:'REVIEW_REQUIRED'}]};
   writes+=1;
   if(sql.startsWith('INSERT'))return stage==='archive'?attempt:
    {rowCount:1,rows:[{id:args[0],job_id:jobId,kind:'pod.repair.archived'}]};
   if(sql.startsWith('UPDATE'))return stage==='queue'?attempt:
    {rowCount:1,rows:[{id:jobId,state:'raw',reason_code:null}]};
   throw Error('unexpected repair query');
  }});
  await assert.rejects(db.requeueRepair(jobId,signed()),/POD_MUTATION_UNVERIFIED/);
  assert.equal(writes,stage==='archive'?1:2);
 }
});
