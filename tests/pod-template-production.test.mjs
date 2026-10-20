import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
import {validateTemplate,validateInteriorTemplate} from '../integrations/pod/templates.mjs';
import {setTimeout as pause} from 'node:timers/promises';

const key='synthetic-template-test-key-'.repeat(2);
const sign=value=>{
 const payload=JSON.stringify({schema_version:1,issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
};
const scope={product:'fixture-shirt',country:'US'};
const retainedSource=Buffer.from('retained synthetic cover source, not official evidence');
const kdpCover=(spec={page_count:24,paper_type:'white',trim_inches:[6,9]})=>{
 const spine=spec.page_count*({white:.002252,cream:.0025,groundwood:.00235}[spec.paper_type]);
 return {size_inches:[2*spec.trim_inches[0]+spine+.25,spec.trim_inches[1]+.25],safe_box_px:[75,75,500,500],
  kdp:{binding:'paperback',ink_type:'black',paper_type:spec.paper_type,page_count:spec.page_count,
   trim_width_inches:spec.trim_inches[0],spine_width_inches:spine,bleed_inches:.125,
   reading_direction:'left_to_right',locale:'en_US',barcode_mode:'amazon_placed'}};
};
const record=(platform='redbubble')=>({audience:'pod:template',...scope,
 official_source_verified:true,source_url:'https://example.org/fixture-template',
 source_sha256:crypto.createHash('sha256').update(retainedSource).digest('hex'),observed_at:new Date().toISOString(),
 template:{platform,dpi:300,size_inches:[2,2],safe_box_px:[50,50,500,500],
  ...(platform==='kdp'?{...kdpCover(),binding:'paperback',ink_type:'black',paper_type:'white',interior_type:'text_no_bleed',page_count:24,
   trim_inches:[6,9],margins_inches:{inside:.375,outside:.25,top:.25,bottom:.25},font_size_pt:10}:{})}});

async function exercise({template=record(),templateScope=scope,platform='redbubble',interior,templateSource=true,sourceBytes=retainedSource,guideFailure,denyGrantAt,grantPatch={revoked:true},localPolicy,review=false,reviewPolicy,detailed=false,captureQaArgs=false,assetRoot=false}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-template-gate-'));
 const originalNow=Date.now;
 try{
  await fs.mkdir(path.join(root,'scripts'));await fs.mkdir(path.join(root,'output'));
  // Synthetic stages expose whether the coordinator launched production. They
  // are not template approval, Python quality tests or marketplace evidence.
  await fs.writeFile(path.join(root,'scripts/pod_asset_generator.py'),
   "require('node:fs').writeFileSync('started','yes');require('node:fs').writeFileSync('output/manifest.json',JSON.stringify({files:{},package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)}));");
  await fs.writeFile(path.join(root,'scripts/pod_book_package.py'),"require('node:fs').writeFileSync('book-started','yes');");
  await fs.writeFile(path.join(root,'scripts/pod_kdp_template_import.py'),
   "const fs=require('node:fs');fs.writeFileSync('guide-started','yes');fs.writeFileSync('guide-profile.json',process.argv[process.argv.indexOf('--profile-json')+1]);if(process.env.FIXTURE_GUIDE_FAILURE){console.log(JSON.stringify({status:'BLOCKED',reason_code:process.env.FIXTURE_GUIDE_FAILURE}));process.exit(2);}");
  await fs.writeFile(path.join(root,'scripts/pod_vision_qa.py'),"require('node:fs').writeFileSync('qa-started','yes');require('node:fs').writeFileSync('qa-args.json',JSON.stringify(process.argv));require('node:fs').writeFileSync('qa-signed.json',JSON.stringify({payload:JSON.stringify({verdict:'PASS'})}));");
  const templatePath=path.join(root,'template.json');
  await fs.writeFile(templatePath,JSON.stringify(sign(template)));
  const sourcePath=path.join(root,'retained-source.bin');
  if(templateSource)await fs.writeFile(sourcePath,sourceBytes);
  const interiorPath=path.join(root,'interior.json');
  if(interior)await fs.writeFile(interiorPath,JSON.stringify(sign(interior)));
  const brief={id:'fixture-job',account_id:'fixture-account',business_id:'fixture-business',
   platform,destination_platform:platform,mode:'PRELAUNCH'};
  let blocked=0,held=0,cleaned=0,grantCalls=0,localChecks=0,reviewCalls=0,completed=0;
  const env={...process.env,POD_PYTHON:process.execPath,POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'};
  if(guideFailure)env.FIXTURE_GUIDE_FAILURE=guideFailure;
  const controller=new AbortController();
  const result=await produceOnce({root,env,signal:controller.signal,upstreamKey:key,
   db:{claimProduction:async()=>({id:brief.id,brief}),failProduction:async()=>{blocked++;},holdProduction:async()=>{held++;},
    completeProduction:async()=>{completed++;return {pass:true};},
    assertProducible:async()=>{localChecks++;await localPolicy?.({env,controller,originalNow});}},
   resolveGrant:async()=>{grantCalls++;return sign({audience:'content-control:pod',job_id:brief.id,account_id:brief.account_id,
    business_id:brief.business_id,platform,max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,
    ...(grantCalls===denyGrantAt?grantPatch:{})});},
   resolveTask:async()=>({rights_verified:true,templateScope,template:templatePath,source:'unused',textLayers:'unused',assetRights:'unused',
    ...(assetRoot?{assetRoot:root}:{}),
    ...(templateSource?{templateSource:sourcePath}:{}),
    output:path.join(root,'output'),reference:'unused',qaOutput:'unused',qaSignedOutput:path.join(root,'qa-signed.json'),...(interior?{interior:{template:interiorPath,pages:'unused',font:'unused'}}:{}),
    ...(review?{reviewPackage:async(manifest,options)=>{reviewCalls++;return await reviewPolicy?.({manifest,options,env,controller})??{rights:'unused',competitive:'unused'};}}:{}),
    cleanup:async()=>{cleaned++;}})});
  const started=await fs.stat(path.join(root,'started')).then(()=>true,()=>false);
  const bookStarted=await fs.stat(path.join(root,'book-started')).then(()=>true,()=>false);
  const qaStarted=await fs.stat(path.join(root,'qa-started')).then(()=>true,()=>false);
  const guideStarted=await fs.stat(path.join(root,'guide-started')).then(()=>true,()=>false);
  const guideProfile=await fs.readFile(path.join(root,'guide-profile.json'),'utf8').then(JSON.parse,()=>null);
  const qaArgs=captureQaArgs?await fs.readFile(path.join(root,'qa-args.json'),'utf8').then(JSON.parse,()=>null):null;
  return {status:result.status,blocked,held,cleaned,started,...(captureQaArgs?{qaArgs}:{}),...(detailed?{reason:result.reason_code,bookStarted,qaStarted,guideStarted,guideProfile,completed,grantCalls,localChecks,reviewCalls}:{})};
 }finally{Date.now=originalNow;await fs.rm(root,{recursive:true,force:true});}
}

test('production rejects unverified template before launching any stage',async()=>{
 assert.deepEqual(await exercise({template:{...record(),official_source_verified:false}}),
  {status:'BLOCKED',blocked:1,held:0,cleaned:1,started:false});
});
test('all platform QA stages receive original art and original asset rights',async()=>{
 for(const platform of ['kdp','redbubble','teepublic','zazzle','spreadshirt']){
  const result=await exercise({platform,template:record(platform),
   ...(platform==='kdp'?{interior:{...record('kdp'),audience:'pod:interior-template'}}:{}),
   review:true,captureQaArgs:true,assetRoot:true});
  assert.equal(result.status,'QA_PASSED');
  for(const flag of ['--source','--asset-rights','--text-layers']){
   assert.equal(result.qaArgs.filter(x=>x===flag).length,1);
   assert.equal(result.qaArgs[result.qaArgs.indexOf(flag)+1],'unused');
  }
  assert.equal(result.qaArgs.filter(x=>x==='--asset-root').length,1);
  assert.match(path.basename(result.qaArgs[result.qaArgs.indexOf('--asset-root')+1]),/^pod-template-gate-/);
 }
});
test('KDP reviewer receives the original task manuscript path and non-book reviewers do not',async()=>{
 for(const platform of ['kdp','redbubble']){
  let original;
  const result=await exercise({platform,template:record(platform),
   ...(platform==='kdp'?{interior:{...record('kdp'),audience:'pod:interior-template'}}:{}),
   review:true,reviewPolicy:async({options})=>{original=options.manuscript;}});
  assert.equal(result.status,'QA_PASSED');
  assert.equal(original,platform==='kdp'?'unused':undefined);
 }
});
test('KDP QA receives the authenticated target country independently of guide locale',async()=>{
 for(const [country,trim_inches] of [['US',[6,9]],['JP',[5.83,8.27]]]){
  const templateScope={...scope,country},spec={...record('kdp').template,trim_inches};
  const cover={...record('kdp'),country,template:{...record('kdp').template,...kdpCover(spec)}};
  const interior={...record('kdp'),country,audience:'pod:interior-template',template:spec};
  const result=await exercise({platform:'kdp',templateScope,template:cover,interior,review:true,captureQaArgs:true});
  assert.equal(result.status,'QA_PASSED');
  assert.equal(result.qaArgs.filter(x=>x==='--country').length,1);
  assert.equal(result.qaArgs[result.qaArgs.indexOf('--country')+1],country);
  assert.equal(result.qaArgs[result.qaArgs.indexOf('--product')+1],templateScope.product);
  assert.equal(result.qaArgs.filter(x=>x==='--manuscript').length,1);
  assert.equal(result.qaArgs[result.qaArgs.indexOf('--manuscript')+1],'unused');
  for(const [flag,filename] of [['--cover-template','template.json'],['--interior-template','interior.json'],['--template-source','retained-source.bin']]){
   assert.equal(result.qaArgs.filter(x=>x===flag).length,1);
   assert.equal(path.basename(result.qaArgs[result.qaArgs.indexOf(flag)+1]),filename);
  }
 }
 const other=await exercise({review:true,captureQaArgs:true});
 assert.equal(other.qaArgs.includes('--asset-root'),false);
 assert.equal(other.qaArgs.includes('--country'),false);
 for(const flag of ['--product','--cover-template','--interior-template','--template-source','--manuscript'])assert.equal(other.qaArgs.includes(flag),false);
});
test('KDP requires an explicit Amazon-placed barcode choice before guide inspection',async()=>{
 for(const barcode_mode of [undefined,null,false,[],'own','amazon']){
  const cover=record('kdp');cover.template.kdp.barcode_mode=barcode_mode;
  const result=await exercise({platform:'kdp',template:cover,interior:{...record('kdp'),audience:'pod:interior-template'},detailed:true});
  assert.equal(result.reason,'KDP_BARCODE_MODE_UNSUPPORTED');assert.equal(result.started,false);
  assert.equal(result.guideStarted,false);assert.equal(result.bookStarted,false);assert.equal(result.cleaned,1);
 }
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
test('KDP requires retained source bytes matching authenticated cover provenance before rendering',async()=>{
 const options={platform:'kdp',template:record('kdp'),interior:{...record('kdp'),audience:'pod:interior-template'},detailed:true};
 for(const [patch,reason] of [[{templateSource:false},'TEMPLATE_SOURCE_REQUIRED'],
  [{sourceBytes:Buffer.from('changed retained source')},'TEMPLATE_SOURCE_HASH_MISMATCH'],
  [{sourceBytes:Buffer.alloc(0)},'TEMPLATE_SOURCE_INVALID']]){
  const r=await exercise({...options,...patch});
  assert.equal(r.reason,reason);assert.equal(r.started,false);assert.equal(r.bookStarted,false);
  assert.equal(r.qaStarted,false);assert.equal(r.held,0);assert.equal(r.completed,0);assert.equal(r.cleaned,1);
 }
 const valid=await exercise(options);
 assert.equal(valid.status,'REVIEW_REQUIRED');assert.equal(valid.started,true);assert.equal(valid.bookStarted,true);
 assert.equal(valid.completed,0);assert.equal(valid.cleaned,1);
});
test('KDP source identity follows the signed envelope rather than an unsigned hash assertion',async()=>{
 const cover={...record('kdp'),source_sha256:'a'.repeat(64)};
 const r=await exercise({platform:'kdp',template:cover,interior:{...record('kdp'),audience:'pod:interior-template'},detailed:true});
 assert.equal(r.reason,'TEMPLATE_SOURCE_HASH_MISMATCH');assert.equal(r.started,false);assert.equal(r.cleaned,1);
 assert.equal((await exercise({templateSource:false})).status,'REVIEW_REQUIRED');
});
test('paperback production enforces every page-dependent gutter boundary',()=>{
 for(const [page_count,inside] of [[24,.375],[150,.375],[151,.5],[300,.5],[301,.625],
  [500,.625],[501,.75],[700,.75],[701,.875],[828,.875]]){
  const template={...record('kdp').template,page_count};
  const validate=inside=>validateInteriorTemplate(sign({...record('kdp'),audience:'pod:interior-template',
   template:{...template,margins_inches:{...template.margins_inches,inside}}}),key,{platform:'kdp',...scope});
  assert.equal(validate(inside).page_count,page_count);
  assert.throws(()=>validate(inside-.001),/KDP_PAPERBACK_SPEC_INVALID/);
 }
});
test('paperback production rejects unsupported or malformed physical specifications',()=>{
 const valid=record('kdp').template;
 for(const patch of [{binding:undefined},{binding:'hardcover'},{interior_type:'image_bleed'},
  {page_count:23},{page_count:829},{page_count:'24'},{page_count:24.5},{page_count:[24]},
  {page_count:{valueOf:null,toString:null}},
  {trim_inches:[3.99,9]},{trim_inches:[8.501,9]},{trim_inches:[6,5.999]},
  {trim_inches:[6,11.691]},{trim_inches:['6',9]},{trim_inches:[NaN,9]},
  {font_size_pt:6.99},{font_size_pt:'7'},{font_size_pt:Infinity},
  ...['inside','outside','top','bottom'].map(k=>({margins_inches:{...valid.margins_inches,[k]:.249}})),
  {margins_inches:null},{margins_inches:{...valid.margins_inches,top:8,bottom:1}}]){
  assert.throws(()=>validateInteriorTemplate(sign({...record('kdp'),audience:'pod:interior-template',
   template:{...valid,...patch}}),key,{platform:'kdp',...scope}),/KDP_PAPERBACK_SPEC_INVALID/);
 }
});
test('paperback baseline permits supported trims and font minimum without claiming print acceptance',()=>{
 for(const trim_inches of [[5,8],[8.25,6],[8.5,11],[8.27,11.69]]){
  const template={...record('kdp').template,trim_inches,font_size_pt:7};
  assert.deepEqual(validateInteriorTemplate(sign({...record('kdp'),audience:'pod:interior-template',template}),key,
   {platform:'kdp',...scope}),template);
 }
});
test('paperback page ceilings follow the selected paper and listed trim',()=>{
 for(const [country,trim_inches,ceilings] of [
  ['US',[6,9],[828,776,812]],['US',[8.25,8.25],[800,750,784]],
  ['US',[8.27,11.69],[780,730,764]],['US',[8.5,11],[590,550,578]],
  ['JP',[8.27,10.12],[780,730,764]]]){
  for(const [index,paper_type] of ['white','cream','groundwood'].entries()){
   const page_count=ceilings[index],template={...record('kdp').template,paper_type,trim_inches,
    margins_inches:{inside:.875,outside:.25,top:.25,bottom:.25}};
   const validate=count=>validateInteriorTemplate(sign({...record('kdp'),country,audience:'pod:interior-template',
    template:{...template,page_count:count}}),key,{platform:'kdp',...scope,country});
   assert.equal(validate(page_count).page_count,page_count);
   assert.throws(()=>validate(page_count+1),/KDP_(PRINT_PAGE_LIMIT|PAPERBACK_SPEC_INVALID)/);
  }
 }
});
test('paperback print options reject unknown paper ink trim and regional tables',()=>{
 const valid=record('kdp').template;
 for(const [country,patch] of [['US',{paper_type:undefined}],['US',{ink_type:undefined}],
  ['US',{paper_type:['white']}],['US',{paper_type:'recycled'}],['US',{ink_type:'premium_color'}],
  ['US',{ink_type:['black']}],['US',{trim_inches:[4,6]}],['US',{trim_inches:[4.06,7.17]}],['CA',{}]]){
  assert.throws(()=>validateInteriorTemplate(sign({...record('kdp'),country,audience:'pod:interior-template',
   template:{...valid,...patch}}),key,{platform:'kdp',...scope,country}),/KDP_PRINT_OPTIONS_UNSUPPORTED/);
 }
 const template={...valid,trim_inches:[4.06,7.17]};
 assert.deepEqual(validateInteriorTemplate(sign({...record('kdp'),country:'JP',audience:'pod:interior-template',template}),
  key,{platform:'kdp',...scope,country:'JP'}),template);
});
test('paper-specific page overflow blocks production before cover generation',async()=>{
 const r=await exercise({platform:'kdp',template:record('kdp'),interior:{...record('kdp'),
  audience:'pod:interior-template',template:{...record('kdp').template,paper_type:'cream',page_count:800,
   margins_inches:{inside:.875,outside:.25,top:.25,bottom:.25}}},detailed:true});
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'KDP_PRINT_PAGE_LIMIT');
 assert.equal(r.started,false);assert.equal(r.bookStarted,false);assert.equal(r.held,0);
 assert.equal(r.completed,0);assert.equal(r.cleaned,1);
});
test('undersized gutter or font blocks KDP before cover generation with a fixed reason',async()=>{
 for(const patch of [{font_size_pt:6},{page_count:301,margins_inches:{inside:.5,outside:.25,top:.25,bottom:.25}}]){
  const r=await exercise({platform:'kdp',template:record('kdp'),interior:{...record('kdp'),
   audience:'pod:interior-template',template:{...record('kdp').template,...patch}},detailed:true});
  assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'KDP_PAPERBACK_SPEC_INVALID');
  assert.equal(r.started,false);assert.equal(r.bookStarted,false);assert.equal(r.held,0);
  assert.equal(r.completed,0);assert.equal(r.cleaned,1);
 }
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

const invalidObservationTimes=[
 '2026-02-30T12:00:00Z','2026-02-29T12:00:00Z','2026-04-31T12:00:00Z',
 '2026-01-01T24:00:00Z','2026-01-01T12:00:00','2026-01-01',
 'January 1, 2026','2026-01-01T12:00:00.1234567Z',0,null,
];
for(const interior of [false,true])test(`official ${interior?'interior':'artwork'} provenance rejects ambiguous observation timestamps`,()=>{
 const platform=interior?'kdp':'redbubble',validate=interior?validateInteriorTemplate:validateTemplate;
 for(const observed_at of invalidObservationTimes){
  const r={...record(platform),audience:interior?'pod:interior-template':'pod:template',observed_at};
  assert.throws(()=>validate(sign(r),key,{platform,...scope}),/TEMPLATE_PROVENANCE_REQUIRED/,String(observed_at));
 }
});
for(const interior of [false,true])test(`official ${interior?'interior':'artwork'} provenance preserves explicit-zone observation timestamps`,()=>{
 const platform=interior?'kdp':'redbubble',validate=interior?validateInteriorTemplate:validateTemplate;
 for(const observed_at of ['2024-02-29T23:59:59Z','2026-01-01T12:00:00.123456Z','2026-01-01T07:00:00-05:00','2026-01-01T17:30:00+05:30']){
  const r={...record(platform),audience:interior?'pod:interior-template':'pod:template',observed_at};
  assert.deepEqual(validate(sign(r),key,{platform,...scope}),r.template);
 }
});
for(const interior of [false,true])test(`invalid ${interior?'interior':'artwork'} observation blocks production before rendering`,async()=>{
 const platform=interior?'kdp':'redbubble';
 const invalid={...record(platform),observed_at:'2026-02-30T12:00:00Z'};
 const result=await exercise({platform,template:interior?record(platform):invalid,
  ...(interior?{interior:{...invalid,audience:'pod:interior-template'}}:{}),detailed:true});
 assert.equal(result.status,'BLOCKED');assert.equal(result.started,false);
 assert.equal(result.bookStarted,false);assert.equal(result.qaStarted,false);
 assert.equal(result.completed,0);assert.equal(result.held,0);assert.equal(result.cleaned,1);
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
 const result=await exercise({platform:'kdp',template:record('kdp'),interior:{...record('kdp'),audience:'pod:interior-template'},denyGrantAt:4,detailed:true});
 assert.equal(result.started,true);assert.equal(result.bookStarted,false);assert.equal(result.held,0);assert.equal(result.status,'BLOCKED');
});

test('KDP inspects the guide with its authenticated paired profile before generation',async()=>{
 const r=await exercise({platform:'kdp',template:record('kdp'),interior:{...record('kdp'),audience:'pod:interior-template'},detailed:true});
 assert.equal(r.status,'REVIEW_REQUIRED');assert.equal(r.guideStarted,true);assert.equal(r.started,true);
 assert.deepEqual(r.guideProfile,{binding:'paperback',ink_type:'black',paper_type:'white',
  reading_direction:'left_to_right',trim_inches:[6,9],page_count:24,locale:'en_US'});
 assert.equal(r.cleaned,1);assert.equal(r.completed,0);
});
test('KDP guide inspection failures block artwork with fixed diagnostics and cleanup',async()=>{
 for(const [guideFailure,reason] of [['KDP_TEMPLATE_ARCHIVE_INVALID','KDP_TEMPLATE_ARCHIVE_INVALID'],
  ['KDP_TEMPLATE_GUIDE_INVALID','KDP_TEMPLATE_GUIDE_INVALID'],['KDP_TEMPLATE_HASH_MISMATCH','KDP_TEMPLATE_HASH_MISMATCH'],
  ['private child details','PRODUCTION_BLOCKED']]){
  const r=await exercise({platform:'kdp',template:record('kdp'),interior:{...record('kdp'),audience:'pod:interior-template'},guideFailure,detailed:true});
  assert.equal(r.guideStarted,true);assert.equal(r.reason,reason);assert.equal(r.started,false);
  assert.equal(r.bookStarted,false);assert.equal(r.qaStarted,false);assert.equal(r.cleaned,1);assert.equal(r.held,0);
 }
});
test('KDP guide locale and reading direction must be explicit supported signed fields',async()=>{
 for(const patch of [{locale:undefined},{locale:'ja_JP'},{locale:['en_US']},
  {reading_direction:undefined},{reading_direction:'right_to_left'},{reading_direction:true}]){
  const cover=record('kdp');cover.template.kdp={...cover.template.kdp,...patch};
  const r=await exercise({platform:'kdp',template:cover,interior:{...record('kdp'),audience:'pod:interior-template'},detailed:true});
  assert.equal(r.reason,'KDP_TEMPLATE_PROFILE_INVALID');assert.equal(r.guideStarted,false);assert.equal(r.started,false);
  assert.equal(r.cleaned,1);
 }
});
test('KDP renews authority before inspection and again before artwork',async()=>{
 for(const denyGrantAt of [2,3]){
  const r=await exercise({platform:'kdp',template:record('kdp'),interior:{...record('kdp'),audience:'pod:interior-template'},denyGrantAt,detailed:true});
  assert.equal(r.guideStarted,denyGrantAt===3);assert.equal(r.started,false);assert.equal(r.bookStarted,false);
  assert.equal(r.status,'BLOCKED');assert.equal(r.cleaned,1);
 }
});
test('revocation after rendering prevents persistence and review hold',async()=>{
 const result=await exercise({denyGrantAt:3});
 assert.equal(result.started,true);assert.equal(result.held,0);assert.equal(result.status,'BLOCKED');
});
test('fresh authority is required before an independent review callback',async()=>{
 const result=await exercise({review:true,denyGrantAt:5,detailed:true});
 assert.equal(result.started,true);assert.equal(result.reviewCalls,0);assert.equal(result.status,'BLOCKED');
});
test('revocation after independent review blocks QA execution',async()=>{
 const r=await exercise({review:true,denyGrantAt:6,detailed:true});
 assert.equal(r.reviewCalls,1);assert.equal(r.qaStarted,false);assert.equal(r.completed,0);assert.equal(r.status,'BLOCKED');
});
test('revocation after QA prevents completion',async()=>{
 const r=await exercise({review:true,denyGrantAt:7,detailed:true});
 assert.equal(r.qaStarted,true);assert.equal(r.completed,0);assert.equal(r.status,'BLOCKED');
});
test('valid stage authority reaches the authenticated completion boundary',async()=>{
 const r=await exercise({review:true,detailed:true});
 assert.equal(r.status,'QA_PASSED');assert.equal(r.completed,1);assert.equal(r.grantCalls,7);assert.equal(r.localChecks,6);
});
test('fresh authority after package reads is required before persistence',async()=>{
 const result=await exercise({review:true,denyGrantAt:4,detailed:true});
 assert.equal(result.started,true);assert.equal(result.reviewCalls,0);assert.equal(result.held,0);assert.equal(result.status,'BLOCKED');
});

test('cooperative reviewer receives the worker signal and abort is recorded as stopped',async()=>{
 let received=false,settled=false;
 const r=await exercise({review:true,detailed:true,reviewPolicy:async({options,controller})=>{
  received=options?.signal===controller.signal;
  setImmediate(()=>controller.abort(Error('private reviewer abort details')));
  try{await pause(100,undefined,{signal:options?.signal});}
  finally{settled=true;}
 }});
 assert.equal(received,true);assert.equal(settled,true);
 assert.equal(r.reason,'PRODUCTION_STOPPED');assert.equal(r.cleaned,1);
 assert.equal(r.qaStarted,false);assert.equal(r.completed,0);assert.equal(r.held,0);
});

for(const action of ['abort','disable'])test(`review rejection after ${action} uses the fixed stop reason`,async()=>{
 const r=await exercise({review:true,detailed:true,reviewPolicy:async({controller,env})=>{
  if(action==='abort')controller.abort(Error('private cancellation reason'));
  else env.POD_PRODUCTION_ENABLED='false';
  // Let an in-flight callback settle before workspace cleanup; no detached race.
  await new Promise(resolve=>setImmediate(resolve));
  throw Error('private reviewer failure');
 }});
 assert.equal(r.reason,'PRODUCTION_STOPPED');assert.equal(r.cleaned,1);
 assert.equal(r.qaStarted,false);assert.equal(r.completed,0);assert.equal(r.reviewCalls,1);
});

test('ordinary reviewer errors remain redacted and do not complete production',async()=>{
 const r=await exercise({review:true,detailed:true,reviewPolicy:async()=>{throw Error('private reviewer failure');}});
 assert.equal(r.reason,'PRODUCTION_BLOCKED');assert.equal(r.cleaned,1);
 assert.equal(r.qaStarted,false);assert.equal(r.completed,0);
});

for(const action of ['abort','disable'])test(`late review result after ${action} is discarded before reading paths`,async()=>{
 let accessed=false;
 const r=await exercise({review:true,detailed:true,reviewPolicy:async({controller,env})=>{
  if(action==='abort')controller.abort();else env.POD_PRODUCTION_ENABLED='false';
  return {get rights(){accessed=true;throw Error('RIGHTS_BLOCKED');}};
 }});
 assert.equal(accessed,false);assert.equal(r.reason,'PRODUCTION_STOPPED');
 assert.equal(r.qaStarted,false);assert.equal(r.completed,0);assert.equal(r.cleaned,1);
});


test('KDP production rejects paper binding ink and physical cover mismatches before rendering',async()=>{
 const cover=record('kdp'),interior={...record('kdp'),audience:'pod:interior-template'};
 for(const patch of [{kdp:undefined},...['binding','ink_type','paper_type','page_count','trim_width_inches','spine_width_inches','bleed_inches'].flatMap(field=>[
  {kdp:{...cover.template.kdp,[field]:undefined}},
  {kdp:{...cover.template.kdp,[field]:field==='paper_type'?'cream':field==='binding'?'hardcover':field==='ink_type'?'color':field==='page_count'?26:field==='trim_width_inches'?5:field==='bleed_inches'?.1:.1}},
  {kdp:{...cover.template.kdp,[field]:[cover.template.kdp[field]]}},
 ]),{size_inches:[cover.template.size_inches[0]+.001,cover.template.size_inches[1]]},
 {size_inches:[cover.template.size_inches[0],cover.template.size_inches[1]+.001]}]){
  const r=await exercise({platform:'kdp',template:{...cover,template:{...cover.template,...patch}},interior,detailed:true});
  assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'COVER_INTERIOR_MISMATCH');
  assert.equal(r.started,false);assert.equal(r.bookStarted,false);assert.equal(r.cleaned,1);
  assert.equal(r.held,0);assert.equal(r.completed,0);
 }
});
test('KDP production requires an explicitly reviewed even manuscript instead of silently rounding',async()=>{
 const spec={...record('kdp').template,page_count:25};
 const cover={...record('kdp'),template:{...record('kdp').template,...kdpCover(spec)}};
 const r=await exercise({platform:'kdp',template:cover,interior:{...record('kdp'),audience:'pod:interior-template',template:spec},detailed:true});
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'KDP_PAGE_COUNT_REQUIRES_REVIEW');
 assert.equal(r.started,false);assert.equal(r.bookStarted,false);assert.equal(r.cleaned,1);assert.equal(r.held,0);
});
test('KDP production accepts matching explicit even-page covers for each supported paper into review only',async()=>{
 for(const paper_type of ['white','cream','groundwood']){
  const spec={...record('kdp').template,paper_type,page_count:100};
  const r=await exercise({platform:'kdp',template:{...record('kdp'),template:{...record('kdp').template,...kdpCover(spec)}},
   interior:{...record('kdp'),audience:'pod:interior-template',template:spec},detailed:true});
  assert.equal(r.status,'REVIEW_REQUIRED');assert.equal(r.started,true);assert.equal(r.bookStarted,true);
  assert.equal(r.held,1);assert.equal(r.completed,0);assert.equal(r.cleaned,1);
 }
});


test('KDP cover safe box keeps quarter-inch margins with conservative fractional-pixel rounding',()=>{
 for(const dpi of [300,600,1200]){
  const size_inches=[2.001,2.003],edge=Math.ceil(dpi*.25);
  const right=Math.floor((size_inches[0]-.25)*dpi),bottom=Math.floor((size_inches[1]-.25)*dpi);
  const safe_box_px=[edge,edge,right-edge,bottom-edge];
  const validate=box=>validateTemplate(sign({...record('kdp'),template:{...record('kdp').template,
   dpi,size_inches,safe_box_px:box}}),key,{platform:'kdp',...scope});
  assert.deepEqual(validate(safe_box_px).safe_box_px,safe_box_px);
  for(const art_is_critical of [0,'false',[],null])assert.throws(()=>validateTemplate(sign({...record('kdp'),
   template:{...record('kdp').template,dpi,size_inches,safe_box_px,art_is_critical}}),key,{platform:'kdp',...scope}),/TEMPLATE_SAFE_ZONE_INVALID/);
  for(const box of [[edge-1,edge,right-edge,bottom-edge],[edge,edge-1,right-edge,bottom-edge],
   [edge,edge,right-edge+1,bottom-edge],[edge,edge,right-edge,bottom-edge+1]]){
   assert.throws(()=>validate(box),/TEMPLATE_SAFE_ZONE_INVALID/);
  }
 }
});
test('KDP cover edge violation blocks before rendering while other platform contracts remain unchanged',async()=>{
 const cover=record('kdp');cover.template.safe_box_px=[74,75,500,500];
 const r=await exercise({platform:'kdp',template:cover,interior:{...record('kdp'),audience:'pod:interior-template'},detailed:true});
 assert.equal(r.reason,'TEMPLATE_SAFE_ZONE_INVALID');assert.equal(r.started,false);assert.equal(r.bookStarted,false);
 assert.equal(r.held,0);assert.equal(r.completed,0);assert.equal(r.cleaned,1);
 assert.equal((await exercise()).status,'REVIEW_REQUIRED');
});

