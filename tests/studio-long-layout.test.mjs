import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const ccsd=JSON.parse(fs.readFileSync('projects/long/credit-card-dlc/ccsd.json','utf8'));
const result=await build({entryPoints:['remotion/StudioLongComposition.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'frame-fixture',setup(build){build.onResolve({filter:/^remotion$/},()=>({path:'remotion',namespace:'frame'}));build.onLoad({filter:/.*/,namespace:'frame'},()=>({contents:'export const useCurrentFrame=()=>globalThis.__longTestFrame;export const useVideoConfig=()=>({fps:24});export const AbsoluteFill="div";'}));}}]});
const {StudioLongComposition,longActionTiming,longActorPose}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const render=(time,doc=ccsd)=>{globalThis.__longTestFrame=time*24;return renderToStaticMarkup(React.createElement(StudioLongComposition,{ccsd:doc}));};
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
 const doc=structuredClone(ccsd);doc.caption_track={status:'PASS',publication_enabled:false,cues:[{start:1,end:2,text:'A narrator line',speaker:'narrator'}]};
 assert.doesNotMatch(render(1.5,doc),/data-speaking-mouth="true"/);
 doc.caption_track.cues[0].speaker='dave';
 assert.equal((render(1.5,doc).match(/data-speaking-mouth="true"/g)||[]).length,1);
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
 for(const [action,motion] of [['fee_drop','fee-weight'],['scoreboard','net-value-delivery'],['autopay','monthly-statement'],['calendar','monthly-payment']]){
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
