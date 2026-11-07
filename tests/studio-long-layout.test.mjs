import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {matchesLongStore} from '../remotion/LongStoreMotion.mjs';
import {matchesLongFinale} from '../remotion/LongFinaleMotion.mjs';
import {matchesLongConsequence} from '../remotion/LongConsequenceMotion.mjs';
const ccsd=JSON.parse(fs.readFileSync('projects/long/credit-card-dlc/ccsd.json','utf8'));
const result=await build({entryPoints:['remotion/StudioLongComposition.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'frame-fixture',setup(build){build.onResolve({filter:/^remotion$/},()=>({path:'remotion',namespace:'frame'}));build.onLoad({filter:/.*/,namespace:'frame'},()=>({contents:'export const useCurrentFrame=()=>globalThis.__longTestFrame;export const useVideoConfig=()=>({fps:24});export const AbsoluteFill="div";'}));}}]});
const {StudioLongComposition,longActionTiming,longActorPose,feeReceiptPose,cardSlamPose}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const render=(time,doc=ccsd)=>{globalThis.__longTestFrame=time*24;return renderToStaticMarkup(React.createElement(StudioLongComposition,{ccsd:doc}));};
test('storyboard performance selectors are disjoint and wired before generic action rendering',()=>{
 const counts=[0,0,0];
 for(const scene of ccsd.scenes){
  const hits=[matchesLongConsequence(scene),matchesLongStore(scene),matchesLongFinale(scene)];
  assert.ok(hits.filter(Boolean).length<=1,scene.id+' has overlapping performance owners');
  hits.forEach((hit,i)=>{if(hit)counts[i]++;});
  if(hits.some(Boolean))assert.match(render((scene.start+scene.end)/2),/data-long-performance-module="storyboard"/);
  if(/^scene-00[0-4]$/.test(scene.id))assert.equal(hits.some(Boolean),false);
 }
 assert.ok(counts.every(n=>n>0));
});
test('physical actions remain continuous across narration cuts',()=>{
 for(let i=1;i<ccsd.scenes.length;i++){
  const scene=ccsd.scenes[i],previous=ccsd.scenes[i-1];
  if(scene.visual.action!==previous.visual.action)continue;
  const before=longActionTiming(ccsd.scenes,i-1,scene.start-1e-6),after=longActionTiming(ccsd.scenes,i,scene.start);
  assert.equal(before.start,after.start);assert.equal(before.end,after.end);
  assert.ok(after.progress>=before.progress&&after.progress-before.progress<1e-5);
 }
});
test('all scenes generate finite SVG and original actions with fitting labels',()=>{
 for(const scene of ccsd.scenes){
  const markup=render((scene.start+scene.end)/2);
  assert.doesNotMatch(markup,/NaN|Infinity|undefined/);
  assert.match(markup,/data-long-action=/);
  for(const [,size,text] of markup.matchAll(/font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)){
   const plain=text.replace(/&[^;]+;/g,'x');
   assert.ok(Number(size)*plain.length*.68<=1100.01,'Text exceeds safe width: '+plain);
  }
 }
});
test('narrator does not animate character mouths',()=>{
 const doc=structuredClone(ccsd);doc.caption_track={status:'PASS',publication_enabled:false,cues:[{start:5.5,end:6.5,text:'A narrator line',speaker:'narrator'}]};
 assert.doesNotMatch(render(5.7,doc),/data-speaking-mouth="true"/);
 doc.caption_track.cues[0].speaker='dave';
 assert.equal((render(5.7,doc).match(/data-speaking-mouth="true"/g)||[]).length,1);
});
test('comparison cards fit their own boxes and action doors distinguish terms',()=>{
 const comparison=ccsd.scenes.find(scene=>scene.visual.action==='scoreboard');
 const markup=render((comparison.start+comparison.end)/2);
 assert.match(markup,/PREMIUM \$70/);assert.match(markup,/FREE \$200/);
 for(const [,size,text] of markup.matchAll(/font-size="([\d.]+)"[^>]*>(PREMIUM \$70|FREE \$200)<\/text>/g))assert.ok(Number(size)*text.length*.68<=164.01);
 const doorScene=ccsd.scenes.find(scene=>scene.visual.action==='doors');
 const doors=render((doorScene.start+doorScene.end)/2);assert.match(doors,/INTRO APR/);assert.match(doors,/DEFERRED/);
});
test('formerly static explanations contain continuing causal prop actions',()=>{
 assert.match(render(10.3),/data-causal-motion="invoice-crushes-dave"/);
 assert.notEqual(render(10.3),render(10.8));
 for(const [action,motion] of [['scoreboard','net-value-delivery'],['autopay','monthly-statement'],['calendar','monthly-payment']]){
  const scene=ccsd.scenes.find(scene=>scene.visual.action===action);
  assert.ok(scene,'Required story action exists: '+action);
  const time=scene.start+Math.min(.1,(scene.end-scene.start)/4);
  const first=render(time),later=render(time+.5);
  assert.match(first,new RegExp('data-causal-motion="'+motion+'"'));
  assert.notEqual(first,later);
 }
});

test('causal acting approaches relevant objects while identity remains shared',()=>{
 const neutral=longActorPose('points',1);
 for(const action of ['fee_drop','cart','callback']){const pose=longActorPose(action,1);assert.ok(pose.dave.x>neutral.dave.x);assert.ok(pose.dave.hand.x>0);}
 for(const action of ['scoreboard','autopay','doors']){const pose=longActorPose(action,1);assert.ok(pose.monk.x<neutral.monk.x);assert.ok(pose.monk.hand.x<0);}
});

test('callback visual matches narrated cutting-board payoff',()=>{
 const scene=ccsd.scenes.find(s=>s.visual.action==='callback');
 const markup=render(scene.start+.7);
 assert.match(markup,/card-cutting-board-callback/);
 assert.match(markup,/data-kitchen-knife="original-svg"/);
 assert.doesNotMatch(markup,/hammer|gavel/);
});
test('interest physically reaches the reward through the encoded failure interval',()=>{
 const a=render(276.75),b=render(277.25);
 assert.match(a,/data-causal-motion="interest-reaches-reward"/);
 assert.match(b,/data-causal-motion="interest-reaches-reward"/);
 const action=markup=>markup.match(/<g data-causal-motion="interest-reaches-reward">(.*?)<\/g><g transform=/)?.[1];
 assert.ok(action(a));assert.notEqual(action(a),action(b));
 assert.match(a,/\$20 REWARD/);
});

test('fee invoice rotated stroke bounds stay between headline and fee badge',()=>{
 // Include the rectangle enclosing all receipt vertices plus the 5px stroke.
 for(let elapsed=0;elapsed<60;elapsed+=1/240){
  const {y,scale,angle,pivotY}=feeReceiptPose(elapsed),r=angle*Math.PI/180;
  for(const x of [-72.5,72.5])for(const py of [-92.5,94.5]){
   const actualY=pivotY+x*scale*Math.sin(r)+(y+py*scale-pivotY)*Math.cos(r);
   assert.ok(actualY>200&&actualY<523,`Receipt outside art safe zone: ${actualY}`);
  }
 }
});
test('loan contract label preserves the complete name within its document',()=>{
 const scene=ccsd.scenes.find(s=>s.visual.action==='terms');
 const markup=render(scene.start+.2);
 assert.match(markup,/>LOAN CONTRACT<\/text>/);
 assert.doesNotMatch(markup,/>LOAN CONTRAC<\/text>/);
 const size=Number(markup.match(/font-size="([\d.]+)"[^>]*>LOAN CONTRACT<\/text>/)?.[1]);
 assert.ok(size>0&&size<=13&&size*13*.68<=128);
});

test('opening card including rotated stroke clears headline throughout slam',()=>{
 for(let elapsed=0;elapsed<40;elapsed+=1/240){
  const {y,scale,angle}=cardSlamPose(elapsed),r=angle*Math.PI/180;
  for(const x of [-92.5,92.5])for(const py of [-57.5,57.5]){
   const actualY=y+scale*(x*Math.sin(r)+py*Math.cos(r));
   assert.ok(actualY>200&&actualY<500,`Card outside headline/table safe region: ${actualY}`);
  }
 }
});

test('opening stages show hand impact, retained dent, hero and reaction framing',()=>{
 const doc=structuredClone(ccsd);
 doc.caption_track={status:'PASS',publication_enabled:false,cues:[{start:1.66,end:1.96,word:'dented',text:'card just dented',speaker:'narrator',scene_id:'scene-000'},{start:2.18,end:2.5,word:'table',text:'dented the table',speaker:'narrator',scene_id:'scene-000'}]};
 assert.match(render(.4,doc),/data-opening-shot="impact-closeup"/);
 assert.match(render(1.7,doc),/data-causal-motion="hand-card-impact"/);
 assert.match(render(2.3,doc),/data-impact-response="table-deformation"/);
 assert.match(render(3,doc),/data-opening-shot="hero-low-angle"/);
 assert.match(render(5.7,doc),/data-opening-shot="reaction-medium"/);
 assert.match(render(5.7,doc),/FINANCIALLY/);
 assert.doesNotMatch(render(9,doc),/data-opening-shot=/);
});


test('hero lift and card highlight leave a clear gap beneath the headline',async()=>{
 const {createRequire}=await import('node:module');
 let sharp;try{sharp=createRequire(import.meta.url)('sharp');}catch(error){if(error.code==='MODULE_NOT_FOUND')return;throw error;}
 for(const time of [4.7,4.8,4.9,5,5.02]){
  let svg=render(time).match(/<svg[\s\S]*<\/svg>/)[0].replace('width="100%" height="100%"','width="1280" height="720"');
  const {data,info}=await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=157;y<167;y++)for(let x=0;x<1280;x++){
   const index=(y*1280+x)*info.channels;
   assert.ok(data[index]>240&&data[index+1]>240&&data[index+2]>240,`Hero art touches headline gap at ${time}s (${x},${y})`);
  }
 }
});
