import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
let sharp;
try{sharp=createRequire(import.meta.url)('sharp');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
import {consequenceTiming,feeConsequencePose,deletionPose,auditCartPose,matchesLongConsequence} from '../remotion/LongConsequenceMotion.mjs';
const ccsd=JSON.parse(fs.readFileSync('projects/long/credit-card-dlc/ccsd.json','utf8'));
ccsd.caption_track=JSON.parse(fs.readFileSync('evidence/actual-long/receipts/captions.json','utf8'));
const timing=consequenceTiming(ccsd);
const compiled=await build({entryPoints:['remotion/LongConsequencePerformance.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const {LongConsequencePerformance}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const render=(time,doc=ccsd)=>renderToStaticMarkup(React.createElement('svg',{xmlns:'http://www.w3.org/2000/svg',viewBox:'0 0 1280 720',width:1280,height:720},React.createElement('rect',{width:1280,height:720,fill:'white'}),React.createElement(LongConsequencePerformance,{ccsd:doc,time,scene:doc.scenes.find(scene=>scene.start<=time&&time<scene.end)})));
test('exact observed cue timestamps drive consequences and inputs remain unchanged',()=>{
 const before=JSON.stringify(ccsd);assert.equal(timing.fall,10.2);assert.equal(timing.impact,11.02);assert.equal(timing.crawl,12.9);assert.equal(timing.title,15.2);
 assert.deepEqual(timing.deletes,[375.333375,375.993375,377.493375]);assert.equal(timing.ladderQuestion,377.033375);assert.equal(timing.ladderAttempt,176.385);
 const changed=structuredClone(ccsd);changed.caption_track.cues.find(c=>c.word==='falls').start+=.2;assert.ok(Math.abs(consequenceTiming(changed).fall-10.4)<1e-10);
 assert.equal(JSON.stringify(ccsd),before);
});
test('fee falls once, crush persists across cuts, Dave crawls free and rises',()=>{
 assert.equal(feeConsequencePose(10.19,timing).invoiceY,285);
 assert.ok(feeConsequencePose(10.6,timing).invoiceY>285);
 assert.equal(feeConsequencePose(11.1,timing).invoiceY,530);
 assert.equal(feeConsequencePose(12.4,timing).phase,'flattened');assert.ok(feeConsequencePose(12.4,timing).squashY<.14);
 assert.ok(feeConsequencePose(13.5,timing).daveX>600);assert.equal(feeConsequencePose(14.9,timing).squashY,1);
 assert.ok(feeConsequencePose(12.291667,timing).squashY<.14,'Scene-007 does not reset the crushing consequence');
});
test('title sting lasts exactly 0.9 seconds and four distinct promise icons follow speech',()=>{
 assert.equal(feeConsequencePose(timing.title-.0001,timing).titleVisible,false);
 assert.equal(feeConsequencePose(timing.title+.8999,timing).titleVisible,true);
 assert.equal(feeConsequencePose(timing.title+.9,timing).titleVisible,false);
 assert.equal(feeConsequencePose(timing.four-.001,timing).iconsVisible,false);
 assert.deepEqual(feeConsequencePose(23.5,timing).iconActive,[true,true,false,false]);
 const markup=render(26.7);for(const name of ['rewards','interest','bonuses','zero-asterisk'])assert.match(markup,new RegExp('data-promise-icon="'+name+'"'));
 assert.match(render(15.5),/data-title-sting="0.9-seconds"/);assert.doesNotMatch(render(16.2),/data-title-sting=/);
});
test('each spoken Delete removes one of three real items; ladder waits for final Delete',()=>{
 const [one,two,three]=timing.deletes;
 assert.equal(deletionPose(one-.001,timing).itemCount,3);assert.equal(deletionPose(one,timing).itemCount,2);
 assert.equal(deletionPose(two,timing).itemCount,1);assert.equal(deletionPose(two,timing).ladderVisible,true);assert.equal(deletionPose(timing.ladderQuestion,timing).ladderVisible,true);
 assert.equal(deletionPose(three,timing).itemCount,0);
 assert.match(render(one-.001),/data-prop="unneeded-extra"/);assert.doesNotMatch(render(one),/data-prop="unneeded-extra"/);
 assert.doesNotMatch(render(two),/data-prop="unneeded-second-extra"/);assert.match(render(two),/data-prop="decorative-ladder"/);assert.match(render(timing.ladderQuestion),/data-prop="decorative-ladder"/);
 for(let time=three;time<378.75;time+=1/24){assert.doesNotMatch(render(time),/data-prop="decorative-ladder"/);assert.match(render(time),/data-final-cart-empty="true"/);}
});
test('earlier no-ladder line has no ladder; attempt begins only at its next observed mention',()=>{
 for(let time=169.625;time<timing.ladderAttempt;time+=1/24){assert.equal(auditCartPose(time,timing).ladderVisible,false);assert.doesNotMatch(render(time),/data-prop="decorative-ladder"/);}
 assert.match(render(timing.ladderAttempt),/data-prop="decorative-ladder"/);
 assert.ok(auditCartPose(178.2,timing).ladderX>auditCartPose(timing.swat,timing).ladderX,'Ladder rebounds away from the cart');
 assert.equal(auditCartPose(178.2,timing).ladderInCart,false);
});
test('selector covers continuation cuts and excludes adjacent modules',()=>{
 const selected=ccsd.scenes.filter(matchesLongConsequence);
 assert.equal(selected.length,20);
 for(const id of ['scene-005','scene-012','scene-132','scene-139','extension-audit-04-cut-04'])assert.ok(matchesLongConsequence({id}));
 for(const id of ['scene-004','scene-013','scene-140','extension-audit-03','extension-audit-05'])assert.equal(matchesLongConsequence({id}),false);
 assert.equal(selected.find(s=>s.id==='scene-139').end,378.75);
});
test('safe-zone captions, narration mouths, finite transforms and state continuity',()=>{
 for(const scene of ccsd.scenes.filter(matchesLongConsequence)){
  const time=(scene.start+scene.end)/2,markup=render(time);
  assert.doesNotMatch(markup,/NaN|Infinity|undefined/);assert.match(markup,/clipPath id="long-consequence-art-safe"/);
  assert.match(markup,/<text x="640" y="73"/);assert.match(markup,/<text x="640" y="155"/);
 }
 assert.doesNotMatch(render(10.3),/data-speaking-mouth="true"/);
 assert.equal((render(15.45).match(/data-speaking-mouth="true"/g)||[]).length,1);
 for(let time=7.958;time<28.708;time+=1/240){for(const value of Object.values(feeConsequencePose(time,timing)))if(typeof value==='number')assert.ok(Number.isFinite(value));}
});
test('SVG rasterization succeeds for all consequence phases without pixels outside safe bands',{skip:!sharp?'Optional sharp rasterizer is not installed':false},async()=>{
 for(const time of [9.5,10.6,11.4,13.5,15.5,26.7,175.5,177.5,375.5,376.3,377.2,378.3]){
  const {data,info}=await sharp(Buffer.from(render(time))).flatten({background:'white'}).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,1280);assert.equal(info.height,720);
  let artPixels=0;
  for(let y=0;y<720;y++)for(let x=0;x<1280;x++){
   const i=(y*1280+x)*info.channels;const ink=data[i]<240||data[i+1]<240||data[i+2]<240;
   if(!ink)continue;
   if(y>=200&&y<=650)artPixels++;
   if(y>85&&y<115||y>166&&y<200||y>650)assert.fail(`Unexpected ink outside safe content bands at ${time}s: ${x},${y}`);
  }
  assert.ok(artPixels>1000,`Action art visible at ${time}s`);
 }
});
// Opt-in local contact sheet; this never invokes Chromium or changes source receipts.
if(process.env.LONG_CONSEQUENCE_STILLS&&sharp){
 const times=[9.5,10.6,11.4,13.5,15.5,26.7,175.5,177.5,375.5,376.3,377.2,378.3];
 const tiles=await Promise.all(times.map(async(time,index)=>({input:await sharp(Buffer.from(render(time))).resize(640,360).png().toBuffer(),left:index%3*640,top:Math.floor(index/3)*360})));
 await sharp({create:{width:1920,height:1440,channels:4,background:'white'}}).composite(tiles).png().toFile(process.env.LONG_CONSEQUENCE_STILLS);
}

test('holds have motivated approach, handling and departure while past cost is clearly retired',()=>{
 assert.ok(feeConsequencePose(8.8,timing).daveX>feeConsequencePose(8,timing).daveX);
 assert.ok(feeConsequencePose(12.6,timing).invoiceX>feeConsequencePose(11.5,timing).invoiceX);
 assert.ok(feeConsequencePose(17.2,timing).daveX<feeConsequencePose(16.5,timing).daveX);
 assert.notEqual(auditCartPose(169.7,timing).cartOffset,auditCartPose(170.4,timing).cartOffset);
 assert.ok(auditCartPose(179.2,timing).ladderX>auditCartPose(178.3,timing).ladderX);
 assert.match(render(372),/PAST EXAMPLE/);assert.match(render(372),/data-past-cost-example="true"/);
 assert.doesNotMatch(render(375.5),/PAST EXAMPLE|−\$200|data-past-cost-example/);
 assert.ok(deletionPose(378.5,timing).cartOffset>deletionPose(377.7,timing).cartOffset);
});
if(process.env.LONG_CONSEQUENCE_SEQUENCE&&sharp){
 const root=process.env.LONG_CONSEQUENCE_SEQUENCE;fs.mkdirSync(root,{recursive:true});
 for(const [name,start,end] of [['fee-consequence',191,689],['audit-cart',4071,4305],['ladder-deletions',8830,9090]]){
  fs.mkdirSync(root+'/'+name,{recursive:true});let index=0;
  for(let frame=start;frame<end;frame+=3){await sharp(Buffer.from(render(frame/24))).png().toFile(`${root}/${name}/${String(index++).padStart(4,'0')}.png`);}
 }
}
