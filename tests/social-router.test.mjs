import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createSocialRouter} from '../social-router.js';

async function fixture(run,{missing=false,fetchImpl}={}) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'social-http-'));
 const original=process.env.PUBLICATION_ENABLED;process.env.PUBLICATION_ENABLED='true';
 const queue={version:1,queue:[{id:'existing',source_url:'https://www.instagram.com/reel/DeUlQTQxv5O/',publication_enabled:false}]};
 if(!missing){await fs.writeFile(path.join(root,'capability-queue.json'),JSON.stringify(queue));await fs.writeFile(path.join(root,'social-capabilities.json'),JSON.stringify({platforms:[]}));}
 const app=express();app.use('/api/social',createSocialRouter({root,fetchImpl}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/api/social`;
 try{await run(base,root);}finally{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});if(original===undefined)delete process.env.PUBLICATION_ENABLED;else process.env.PUBLICATION_ENABLED=original;}
}
test('HTTP status returns real queue and explicit locked/missing revenue state',()=>fixture(async(base)=>{
 const r=await fetch(base+'/status');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const d=await r.json();assert.equal(d.records[0].id,'existing');assert.equal(d.publication_enabled,false);assert.equal(d.external_actions_enabled,false);assert.equal(d.automatic_token_renewal,false);assert.equal(d.revenue.net_profit,null);
}));
test('HTTP validation canonicalizes duplicates without persisting a new job',()=>fixture(async(base,root)=>{
 const before=await fs.readFile(path.join(root,'capability-queue.json'),'utf8');
 const r=await fetch(base+'/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://instagram.com/p/DeUlQTQxv5O/?utm_source=test'})});
 const d=await r.json();assert.equal(r.status,200);assert.equal(d.duplicate,true);assert.equal(d.record_id,'existing');assert.equal(d.saved,false);assert.equal(d.publication_enabled,false);
 assert.equal(await fs.readFile(path.join(root,'capability-queue.json'),'utf8'),before);
 const invalid=await fetch(base+'/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://instagram.com.evil.test/reel/id'})});assert.equal(invalid.status,400);
}));
test('external action endpoints reject all mutation methods despite enabled environment and retries',()=>fixture(async(base)=>{
 for(const action of ['publish','schedule','messages','ads','spend','unknown'])for(const method of ['POST','PUT','PATCH','DELETE']) {
  const r=await fetch(`${base}/${action}`,{method});assert.equal(r.status,403,`${method} ${action}`);const d=await r.json();assert.equal(d.error,'PUBLICATION_DISABLED');assert.equal(d.publication_enabled,false);
 }
 const retry=await fetch(base+'/publish',{method:'POST'});assert.equal(retry.status,403);
 for(const action of ['publish','schedule','messages','ads','unknown'])assert.equal((await fetch(base+'/'+action)).status,404);
}));
test('intake explicitly fails without a durable authenticated writer and does not mutate',()=>fixture(async(base,root)=>{
 const before=await fs.readFile(path.join(root,'capability-queue.json'),'utf8');
 const r=await fetch(base+'/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://youtu.be/abcdefghijk'})});
 const d=await r.json();assert.equal(r.status,503);assert.equal(d.saved,false);assert.equal(d.error,'AUTHENTICATED_DURABLE_WRITER_NOT_CONFIGURED');assert.equal(await fs.readFile(path.join(root,'capability-queue.json'),'utf8'),before);
}));
test('missing status data returns 503 rather than empty successful dashboard',()=>fixture(async(base)=>{const r=await fetch(base+'/status');assert.equal(r.status,503);assert.equal((await r.json()).publication_enabled,false);},{missing:true}));

test('malformed and oversized JSON return locked structured errors',()=>fixture(async(base)=>{
 for(const [body,status,error] of [['{',400,'INVALID_REQUEST_BODY'],[JSON.stringify({url:'x'.repeat(5000)}),413,'REQUEST_TOO_LARGE']]) {
  const r=await fetch(base+'/validate',{method:'POST',headers:{'content-type':'application/json'},body});
  assert.equal(r.status,status);const data=await r.json();assert.equal(data.error,error);assert.equal(data.publication_enabled,false);assert.equal(data.external_actions_enabled,false);
 }
}));
test('invalid persisted queue schema is an unavailable source, not a client error',()=>fixture(async(base,root)=>{
 await fs.writeFile(path.join(root,'capability-queue.json'),JSON.stringify({queue:{}}));
 assert.equal((await fetch(base+'/status')).status,503);
 const r=await fetch(base+'/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://youtu.be/abcdefghijk'})});
 assert.equal(r.status,503);assert.equal((await r.json()).error,'QUEUE_SOURCE_UNAVAILABLE');
}));
test('status evaluates dated connection observations without performing provider calls',()=>fixture(async(base,root)=>{
 await fs.writeFile(path.join(root,'social-capabilities.json'),JSON.stringify({platforms:[{id:'instagram',connection:{last_read_verified_at:'2020-01-01'}}]}));
 const data=await (await fetch(base+'/status')).json();
 assert.equal(data.connection_health[0].status,'stale');assert.equal(data.connection_health[0].read_verified,false);assert.equal(data.connection_health[0].renewal.automatic,false);
}));

for(const [name,payload,status] of [['valid',{ideas:[{id:'linked',source_record:{repository:'wecreates/content-control'},publication_enabled:false},{id:'unrelated',source_record:{repository:'other'}}]},200],['missing collection',{},503],['malformed collection',{ideas:{}},503],['null entry',{ideas:[null]},503]]) {
 test(`Money Factory bridge validates ${name} without external requests`,()=>fixture(async(base)=>{
  const response=await fetch(base+'/project-links');assert.equal(response.status,status);const data=await response.json();assert.equal(data.publication_enabled,false);
  if(status===200){assert.equal(data.references.length,1);assert.equal(data.references[0].id,'linked');assert.equal(data.verification_scope,'repository_references_only_not_runtime_routing_or_revenue');assert.equal(data.verified_at,undefined);assert.ok(data.retrieved_at);}
 },{fetchImpl:async()=>({ok:true,json:async()=>payload})}));
}

test('public status projects connection fields and strips explicit nested credentials without changing evidence prose',()=>fixture(async(base,root)=>{
 const connection={status:'unverified',connected:false,access_token:'private-access',refreshToken:'private-refresh',client_secret:'private-client',nested:{secret:'private-nested'},read_check:{provider:'vidIQ',observed:'accounts=[]',result:'no_connected_account',credentials:{token:'private-read'}}};
 const capabilities={platforms:[{id:'instagram',scopes:'instagram_business_basic',actions:{account:{documented:'documented',runtime:'unverified'}},connection}]};
 const queue={queue:[{id:'record',source_url:'https://instagram.com/reel/example/',connection,evidence:[{kind:'metadata',summary:'Creator explains authentication tokens',accessToken:'private-evidence',details:{Authorization:'private-header',normal:'keep'}}]}]};
 await fs.writeFile(path.join(root,'social-capabilities.json'),JSON.stringify(capabilities));
 await fs.writeFile(path.join(root,'capability-queue.json'),JSON.stringify(queue));
 const response=await fetch(base+'/status');assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes('private-'));
 const data=JSON.parse(text);assert.equal(data.capabilities.platforms[0].scopes,'instagram_business_basic');assert.equal(data.capabilities.platforms[0].actions.account.documented,'documented');
 assert.deepEqual(data.capabilities.platforms[0].connection,{status:'unverified',connected:false,read_check:{provider:'vidIQ',observed:'accounts=[]',result:'no_connected_account'}});
 assert.equal(data.records[0].evidence[0].summary,'Creator explains authentication tokens');assert.deepEqual(data.records[0].evidence[0].details,{normal:'keep'});
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'capability-queue.json'),'utf8')),queue);
}));

test('Money Factory includes secondary Watch references and validates their recorded evidence',()=>fixture(async(base,root)=>{
 const queue={queue:[{id:'reel',coverage:{sampled_frame_seconds:[4]},evidence:[{id:'frame',kind:'sampled_frame',seconds:4,verified:true}],findings:[{id:'watch',category:'Content-production technique',project:'Content Control',summary:'Observed visual alternation',basis:'sampled_frame',evidence_refs:['frame'],full_analysis:false}]}]};
 await fs.writeFile(path.join(root,'capability-queue.json'),JSON.stringify(queue));
 const data=await (await fetch(base+'/project-links')).json();
 assert.equal(data.references.length,1);
 const ref=data.references[0];
 assert.equal(ref.additional_content_reference.finding_id,'watch');
 assert.equal(ref.additional_content_reference.access_token,undefined);
 assert.equal(ref.publication_enabled,false);
 assert.equal(ref.reference_checks[0].status,'verified_repository_evidence');
 assert.equal(ref.reference_checks[0].evidence_verified,true);
 assert.equal(ref.reference_checks[0].full_analysis,false);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'capability-queue.json'),'utf8')),queue);
 queue.queue[0].evidence[0].verified=false;
 await fs.writeFile(path.join(root,'capability-queue.json'),JSON.stringify(queue));
 const rejected=await (await fetch(base+'/project-links')).json();
 assert.equal(rejected.references[0].reference_checks[0].status,'evidence_invalid');
 assert.equal(rejected.references[0].reference_checks[0].evidence_verified,false);
},{fetchImpl:async()=>({ok:true,json:async()=>({ideas:[{id:'linked',publication_enabled:true,additional_content_reference:{repository:'wecreates/content-control',path:'capability-queue.json',id:'reel',finding_id:'watch',basis:'sampled_frame',full_analysis:false,access_token:'must-not-leak'}}]})})}));
