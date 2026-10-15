import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
import {validateTemplate} from '../integrations/pod/templates.mjs';

const key='synthetic-template-test-key-'.repeat(2);
const sign=value=>{
 const payload=JSON.stringify({schema_version:1,issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
};
const scope={product:'fixture-shirt',country:'US'};
const record=(platform='redbubble')=>({audience:'pod:template',...scope,
 official_source_verified:true,source_url:'https://example.org/fixture-template',
 source_sha256:'a'.repeat(64),observed_at:new Date().toISOString(),
 template:{platform,dpi:300,size_inches:[2,2],safe_box_px:[50,50,500,500]}});

async function exercise({template=record(),templateScope=scope,platform='redbubble',interior,denyGrantAt,grantPatch={revoked:true},localPolicy,review=false,detailed=false}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-template-gate-'));
 const originalNow=Date.now;
 try{
  await fs.mkdir(path.join(root,'scripts'));await fs.mkdir(path.join(root,'output'));
  // Synthetic stages expose whether the coordinator launched production. They
  // are not template approval, Python quality tests or marketplace evidence.
  await fs.writeFile(path.join(root,'scripts/pod_asset_generator.py'),
   "require('node:fs').writeFileSync('started','yes');require('node:fs').writeFileSync('output/manifest.json',JSON.stringify({files:{},package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)}));");
  await fs.writeFile(path.join(root,'scripts/pod_book_package.py'),"require('node:fs').writeFileSync('book-started','yes');");
  await fs.writeFile(path.join(root,'scripts/pod_vision_qa.py'),"require('node:fs').writeFileSync('qa-started','yes');require('node:fs').writeFileSync('qa-signed.json',JSON.stringify({payload:JSON.stringify({verdict:'PASS'})}));");
  const templatePath=path.join(root,'template.json');
  await fs.writeFile(templatePath,JSON.stringify(sign(template)));
  const interiorPath=path.join(root,'interior.json');
  if(interior)await fs.writeFile(interiorPath,JSON.stringify(sign(interior)));
  const brief={id:'fixture-job',account_id:'fixture-account',business_id:'fixture-business',
   platform,destination_platform:platform,mode:'PRELAUNCH'};
  let blocked=0,held=0,cleaned=0,grantCalls=0,localChecks=0,reviewCalls=0,completed=0;
  const env={...process.env,POD_PYTHON:process.execPath,POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'};
  const controller=new AbortController();
  const result=await produceOnce({root,env,signal:controller.signal,upstreamKey:key,
   db:{claimProduction:async()=>({id:brief.id,brief}),failProduction:async()=>{blocked++;},holdProduction:async()=>{held++;},
    completeProduction:async()=>{completed++;return {pass:true};},
    assertProducible:async()=>{localChecks++;await localPolicy?.({env,controller,originalNow});}},
   resolveGrant:async()=>{grantCalls++;return sign({audience:'content-control:pod',job_id:brief.id,account_id:brief.account_id,
    business_id:brief.business_id,platform,max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,
    ...(grantCalls===denyGrantAt?grantPatch:{})});},
   resolveTask:async()=>({rights_verified:true,templateScope,template:templatePath,source:'unused',textLayers:'unused',assetRights:'unused',
    output:path.join(root,'output'),reference:'unused',qaOutput:'unused',qaSignedOutput:path.join(root,'qa-signed.json'),...(interior?{interior:{template:interiorPath,pages:'unused',font:'unused'}}:{}),
    ...(review?{reviewPackage:async()=>{reviewCalls++;return {rights:'unused',competitive:'unused'};}}:{}),
    cleanup:async()=>{cleaned++;}})});
  const started=await fs.stat(path.join(root,'started')).then(()=>true,()=>false);
  const bookStarted=await fs.stat(path.join(root,'book-started')).then(()=>true,()=>false);
  const qaStarted=await fs.stat(path.join(root,'qa-started')).then(()=>true,()=>false);
  return {status:result.status,blocked,held,cleaned,started,...(detailed?{bookStarted,qaStarted,completed,grantCalls,localChecks,reviewCalls}:{})};
 }finally{Date.now=originalNow;await fs.rm(root,{recursive:true,force:true});}
}

test('production rejects unverified template before launching any stage',async()=>{
 assert.deepEqual(await exercise({template:{...record(),official_source_verified:false}}),
  {status:'BLOCKED',blocked:1,held:0,cleaned:1,started:false});
});
test('production rejects wrong platform country and product despite a valid signature',async()=>{
 for(const patch of [{country:'CA'},{product:'other'},{template:{...record().template,platform:'zazzle'}}]){
  assert.equal((await exercise({template:{...record(),...patch}})).started,false);
 }
});
test('production rejects missing scope instead of accepting matching undefined values',async()=>{
 assert.equal((await exercise({templateScope:{}})).started,false);
});
test('production accepts current scope-bound official template only into review hold',async()=>{
 assert.deepEqual(await exercise(),{status:'REVIEW_REQUIRED',blocked:0,held:1,cleaned:1,started:true});
});
test('KDP interior provenance is checked before cover generation',async()=>{
 const cover=record('kdp');
 const interior={...record('kdp'),audience:'pod:interior-template',official_source_verified:false};
 assert.deepEqual(await exercise({platform:'kdp',template:cover,interior}),
  {status:'BLOCKED',blocked:1,held:0,cleaned:1,started:false});
});
test('KDP interior must match the authorized product and country',async()=>{
 for(const change of [{country:'CA'},{product:'other'}]){
  const interior={...record('kdp'),audience:'pod:interior-template',...change};
  assert.equal((await exercise({platform:'kdp',template:record('kdp'),interior})).started,false);
 }
});
test('KDP missing interior blocks before generation and valid pair reaches review',async()=>{
 assert.equal((await exercise({platform:'kdp',template:record('kdp')})).started,false);
 const interior={...record('kdp'),audience:'pod:interior-template'};
 assert.equal((await exercise({platform:'kdp',template:record('kdp'),interior})).status,'REVIEW_REQUIRED');
});
test('template provenance rejects credential URLs and future observations',()=>{
 for(const change of [{source_url:'https://user:password@example.org/template'},
   {source_url:'https://'}, {observed_at:new Date(Date.now()+60000).toISOString()}]){
  assert.throws(()=>validateTemplate(sign({...record(),...change}),key,{platform:'redbubble',...scope}),/TEMPLATE_PROVENANCE_REQUIRED/);
 }
});
test('template scope is explicitly required even when record fields are missing',()=>{
 const r=record();delete r.product;delete r.country;
 assert.throws(()=>validateTemplate(sign(r),key,{platform:'redbubble'}),/TEMPLATE_PROVENANCE_REQUIRED/);
});
test('fresh authority after task resolution can revoke or narrow production permission',async()=>{
 for(const grantPatch of [{revoked:true},{production_permission:false},{max_mode:'RESEARCH'},{job_id:'different-job'}]){
  const result=await exercise({denyGrantAt:2,grantPatch});
  assert.equal(result.status,'BLOCKED');assert.equal(result.started,false);assert.equal(result.held,0);
 }
});
test('current local rights and lease must pass before rendering',async()=>{
 const result=await exercise({localPolicy:()=>{throw Error('LOCAL_PRODUCTION_BLOCKED');}});
 assert.equal(result.started,false);assert.equal(result.status,'BLOCKED');
});
test('kill switch and cancellation after the local check prevent rendering',async()=>{
 for(const localPolicy of [({env})=>{env.POD_PRODUCTION_ENABLED='false';},({controller})=>controller.abort()]){
  assert.equal((await exercise({localPolicy})).started,false);
 }
});
test('grant expiring during the local database check prevents rendering',async()=>{
 const result=await exercise({localPolicy:({originalNow})=>{Date.now=()=>originalNow()+120000;}});
 assert.equal(result.started,false);assert.equal(result.status,'BLOCKED');
});
test('KDP refreshes authority between artwork and interior stages',async()=>{
 const result=await exercise({platform:'kdp',template:record('kdp'),interior:{...record('kdp'),audience:'pod:interior-template'},denyGrantAt:3,detailed:true});
 assert.equal(result.started,true);assert.equal(result.bookStarted,false);assert.equal(result.held,0);assert.equal(result.status,'BLOCKED');
});
test('revocation after rendering prevents persistence and review hold',async()=>{
 const result=await exercise({denyGrantAt:3});
 assert.equal(result.started,true);assert.equal(result.held,0);assert.equal(result.status,'BLOCKED');
});
test('fresh authority is required before an independent review callback',async()=>{
 const result=await exercise({review:true,denyGrantAt:4,detailed:true});
 assert.equal(result.started,true);assert.equal(result.reviewCalls,0);assert.equal(result.status,'BLOCKED');
});
test('revocation after independent review blocks QA execution',async()=>{
 const r=await exercise({review:true,denyGrantAt:5,detailed:true});
 assert.equal(r.reviewCalls,1);assert.equal(r.qaStarted,false);assert.equal(r.completed,0);assert.equal(r.status,'BLOCKED');
});
test('revocation after QA prevents completion',async()=>{
 const r=await exercise({review:true,denyGrantAt:6,detailed:true});
 assert.equal(r.qaStarted,true);assert.equal(r.completed,0);assert.equal(r.status,'BLOCKED');
});
test('valid stage authority reaches the authenticated completion boundary',async()=>{
 const r=await exercise({review:true,detailed:true});
 assert.equal(r.status,'QA_PASSED');assert.equal(r.completed,1);assert.equal(r.grantCalls,6);assert.equal(r.localChecks,5);
});
