import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
import {startProductionRuntime} from '../integrations/pod/production-runtime.mjs';

for(const verdict of ['PASS','FAIL'])test(`nonzero QA process with ${verdict} output cannot produce QA_PASSED`,async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-qa-exit-'));
 try{
  await fs.mkdir(path.join(root,'scripts'));await fs.mkdir(path.join(root,'output'));
  // Node executes synthetic stage fixtures; this tests coordinator control flow,
  // not graphics quality or signature acceptance (the real DB verifies those).
  await fs.writeFile(path.join(root,'scripts','pod_asset_generator.py'),
   "const fs=require('node:fs'),c=require('node:crypto'),names=['print.png','art-mask.png','text-mask.png'];for(const n of names)fs.writeFileSync('output/'+n,n);const files=Object.fromEntries(names.map(n=>[n,c.createHash('sha256').update(n).digest('hex')]));fs.writeFileSync('output/manifest.json',JSON.stringify({files,package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)}));");
  await fs.writeFile(path.join(root,'scripts','pod_vision_qa.py'),
   `require('node:fs').writeFileSync('qa.json',JSON.stringify({payload:JSON.stringify({verdict:${JSON.stringify(verdict)}})}));process.exit(2);`);
  const key='k'.repeat(48),brief={id:'job',account_id:'account',business_id:'business',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
  const templateScope={product:'fixture-shirt',country:'US'};
  const templatePayload=JSON.stringify({schema_version:1,audience:'pod:template',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
   ...templateScope,official_source_verified:true,source_url:'https://example.org/fixture',source_sha256:'a'.repeat(64),observed_at:new Date().toISOString(),
   template:{platform:'redbubble',dpi:300,size_inches:[2,2],safe_box_px:[50,50,500,500]}});
  const templatePath=path.join(root,'template.json');
  await fs.writeFile(templatePath,JSON.stringify({payload:templatePayload,signature:crypto.createHmac('sha256',key).update(templatePayload).digest('hex')}));
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
   job_id:brief.id,account_id:brief.account_id,business_id:brief.business_id,platform:brief.platform,max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
  let completed=0,blocked=0,cleaned=0;
  const options={root,env:{...process.env,POD_PYTHON:process.execPath,POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,POD_UPSTREAM_KEY:key},upstreamKey:key,
   db:{recover:async()=>{},assertProducible:async()=>true,claimProduction:async()=>({id:brief.id,brief}),failProduction:async()=>{blocked++;},completeProduction:async()=>{completed++;return {pass:false};},
    tx:async fn=>fn({query:async sql=>sql.includes('sum(')?{rows:[{bytes:'0'}]}:{rows:[]}})},
   resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
   resolveTask:async()=>({rights_verified:true,templateScope,source:'unused',template:templatePath,textLayers:'unused',assetRights:'unused',
    output:path.join(root,'output'),reference:'unused',qaOutput:'unused',qaSignedOutput:path.join(root,'qa.json'),
    reviewPackage:async()=>({rights:'unused',competitive:'unused'}),cleanup:async()=>{cleaned++;}})};
  const result=await produceOnce(options);
  assert.equal(result.status,verdict==='PASS'?'BLOCKED':'QA_FAILED');
  assert.equal(completed,verdict==='PASS'?0:1);assert.equal(blocked,verdict==='PASS'?1:0);assert.equal(cleaned,1);
  let observed,timer;const failure=new Promise(resolve=>observed=resolve);
  const runtime=startProductionRuntime({db:options.db,env:options.env,
   production:{root,resolveTask:options.resolveTask,resolveGrant:options.resolveGrant},onError:observed});
  try{
   const report=await Promise.race([failure,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('health event missing')),5000);})]);
   assert.equal(report.code,verdict==='PASS'?'QA_PROCESS_RESULT_CONFLICT':'QA_FAILED');
   assert.equal(runtime.health().consecutive_failures,1);
   assert.equal(runtime.health().last_result,verdict==='PASS'?'BLOCKED':'QA_FAILED');
  }finally{clearTimeout(timer);await runtime.stop();}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
