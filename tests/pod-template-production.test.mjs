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

async function exercise({template=record(),templateScope=scope,platform='redbubble',interior}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-template-gate-'));
 try{
  await fs.mkdir(path.join(root,'scripts'));await fs.mkdir(path.join(root,'output'));
  // Synthetic stages expose whether the coordinator launched production. They
  // are not template approval, Python quality tests or marketplace evidence.
  await fs.writeFile(path.join(root,'scripts/pod_asset_generator.py'),
   "require('node:fs').writeFileSync('started','yes');require('node:fs').writeFileSync('output/manifest.json',JSON.stringify({files:{},package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)}));");
  await fs.writeFile(path.join(root,'scripts/pod_book_package.py'),'');
  const templatePath=path.join(root,'template.json');
  await fs.writeFile(templatePath,JSON.stringify(sign(template)));
  const interiorPath=path.join(root,'interior.json');
  if(interior)await fs.writeFile(interiorPath,JSON.stringify(sign(interior)));
  const brief={id:'fixture-job',account_id:'fixture-account',business_id:'fixture-business',
   platform,destination_platform:platform,mode:'PRELAUNCH'};
  let blocked=0,held=0,cleaned=0;
  const result=await produceOnce({root,env:{...process.env,POD_PYTHON:process.execPath,
   POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'},upstreamKey:key,
   db:{claimProduction:async()=>({id:brief.id,brief}),failProduction:async()=>{blocked++;},holdProduction:async()=>{held++;}},
   resolveGrant:async()=>sign({audience:'content-control:pod',job_id:brief.id,account_id:brief.account_id,
    business_id:brief.business_id,platform,max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false}),
   resolveTask:async()=>({rights_verified:true,templateScope,template:templatePath,source:'unused',textLayers:'unused',assetRights:'unused',
    output:path.join(root,'output'),...(interior?{interior:{template:interiorPath,pages:'unused',font:'unused'}}:{}),
    cleanup:async()=>{cleaned++;}})});
  const started=await fs.stat(path.join(root,'started')).then(()=>true,()=>false);
  return {status:result.status,blocked,held,cleaned,started};
 }finally{await fs.rm(root,{recursive:true,force:true});}
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
