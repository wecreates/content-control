import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-expiry-key-'.repeat(3),job={id:'expiry-job',fencing_token:1,platform:'redbubble'};
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:
 JSON.stringify(value);
const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
 package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
  'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
const manifestSha256=crypto.createHash('sha256').update(canonical(manifest)).digest('hex');
const actions=[
 ['review','PASS',(db,qa)=>db.acceptReview(job.id,qa)],
 ['passing completion','PASS',(db,qa)=>db.completeProduction(job,manifest,qa)],
 ['failing completion','FAIL',(db,qa)=>db.completeProduction(job,manifest,qa)]
];
async function exercise(stage,verdict,run,expired){
 const originalNow=Date.now,issued=originalNow();let now=issued;
 Date.now=()=>now;
 try{
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:issued-1,
   expires_at_ms:issued+1000,verdict,...manifest,
   checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance','template_provenance','manuscript_provenance','source_font','font_rights','book_details'].map(k=>[k,true]))});
  const qa={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
  const writes=[],queries=[];
  const advance=()=>{now=issued+(expired?1000:999);};
  const client={release(){},query:async sql=>{
   sql=typeof sql==='string'?sql:sql.text;
   queries.push(sql);
   if(stage==='rights'&&sql.includes('FOR SHARE OF p'))advance();
   if(stage==='event'&&sql.startsWith('INSERT INTO pod_events'))advance();
   if(sql.startsWith('SELECT'))return {rows:[{...job,platform:'redbubble',manifest,manifest_sha256:manifestSha256,
    valid:true,rights_state:'PASS',permanently_unpublished:false}]};
   if(/^(UPDATE|INSERT)/.test(sql)){writes.push(sql);return {rows:[{id:job.id}]};}
   return {rows:[]};
  }};
  const db=new PodDB({pool:{connect:async()=>{if(stage==='connection')advance();return client;}},
   bridge,qaKey:key,expiresAt:'2099-01-01T00:00:00Z'});
  if(expired){
   await assert.rejects(run(db,qa),/ENVELOPE_EXPIRED_OR_INVALID/);
   assert.equal(writes.length,stage==='event'?2:0);assert.equal(queries.at(-2),'ROLLBACK');
  }else{
   await run(db,qa);assert.equal(writes.length,2);assert.equal(queries.at(-2),'COMMIT');
  }
 }finally{Date.now=originalNow;}
}
for(const [label,verdict,run] of actions){
 test('QA expiry during connection wait blocks '+label,()=>exercise('connection',verdict,run,true));
 test('QA expiry during event write rolls back '+label,()=>exercise('event',verdict,run,true));
 test('unexpired signed QA permits '+label,()=>exercise('connection',verdict,run,false));
 if(verdict==='PASS')test('QA expiry during rights lock wait blocks '+label,()=>exercise('rights',verdict,run,true));
}

