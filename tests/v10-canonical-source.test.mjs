import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {mapNarrationFrame,frameSpans} from '../remotion/NarrationFrameMap.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(path.join(root,'package.json'));
const esbuild=req('esbuild');const {renderToStaticMarkup}=req('react-dom/server');
const source=(which)=>which==='base'?path.join(root,'tests/fixtures/v10-source-before/V9ArticulatedVisual.jsx'):path.join(root,'remotion/V9ArticulatedVisual.jsx');
async function getVisual(which){const src=fs.readFileSync(source(which),'utf8');const result=await esbuild.transform(src,{loader:'jsx',format:'cjs'});const filename=path.join(root,'remotion/__test_'+which+'.cjs');const m=new Module(filename);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(result.code,filename);return m.exports.V9ArticulatedVisual;}
const old=await getVisual('base');const newer=await getVisual('proposed');
for(let frame=0;frame<720;frame++){assert.equal(renderToStaticMarkup(old({frame})),renderToStaticMarkup(newer({frame})));assert(mapNarrationFrame(frame)>=0&&mapNarrationFrame(frame)<720);}
assert(renderToStaticMarkup(newer({frame:719,finalRuleSize:50})).includes('font-size="50"'));
for(const [start,end,source] of frameSpans){assert.equal(mapNarrationFrame(start),source);assert(mapNarrationFrame(end-1)<=source+59);}
for(let f=660;f<720;f++)assert.equal(mapNarrationFrame(f),719);
const v10=fs.readFileSync(path.join(root,'remotion/Episode1V10FinalProof.jsx'),'utf8');assert(v10.includes('staticFile("audio/episode1-narration.mp3")'));assert(v10.includes('finalRuleSize={50}'));assert(!v10.includes('episode1-music'));assert(!v10.includes('episode1-sfx'));await esbuild.transform(v10,{loader:'jsx'});

// Independent observed-story expectations; do not derive the oracle from frameSpans.
const expectedCuts=[0,43,89,194,308,465,540,612,660,720];
const expectedScenes=[0,1,2,6,8,9,10,11,11];
const fixedSpans=[[0,43,0],[43,89,60],[89,194,120],[194,308,360],
  [308,465,480],[465,540,540],[540,612,600],[612,660,660]];
assert.deepEqual(frameSpans,fixedSpans);
function expectedFrame(frame){
  const f=Math.max(0,Math.floor(frame));
  if(f>=660)return 719;
  const index=expectedCuts.findIndex((start,i)=>i<8&&f>=start&&f<expectedCuts[i+1]);
  return expectedScenes[index]*60+Math.min(59,Math.floor((f-expectedCuts[index])*60/(expectedCuts[index+1]-expectedCuts[index])));
}
let previous=-1;
for(let frame=0;frame<720;frame++){
  const actual=mapNarrationFrame(frame);
  assert.equal(actual,expectedFrame(frame),`fixed expected frame ${frame}`);
  const scene=expectedScenes[expectedCuts.findIndex((a,i)=>i<9&&frame>=a&&frame<expectedCuts[i+1])];
  assert.equal(Math.floor(actual/60),scene,`fixed scene identity ${frame}`);
  assert(actual>=previous);previous=actual;
}
for(let frame=230;frame<=296;frame++)assert.equal(Math.floor(mapNarrationFrame(frame)/60),6);
assert.equal(mapNarrationFrame(-1),0);assert.equal(mapNarrationFrame(720),719);

// Execute the actual proposed V10 component with mocked Remotion hooks and child.
let currentFrame=0;const mappingCalls=[];const visualSentinel=()=>null;
const transformed=await esbuild.transform(v10,{loader:'jsx',format:'cjs'});
const filename=path.join(root,'remotion/__test_v10_wiring.cjs');
const mocked=new Module(filename);mocked.filename=filename;mocked.paths=Module._nodeModulePaths(path.dirname(filename));
mocked.require=(name)=>{
  if(name==='remotion')return {AbsoluteFill:'test-fill',Audio:'test-audio',useCurrentFrame:()=>currentFrame,staticFile:value=>value};
  if(name==='./NarrationFrameMap.mjs')return {mapNarrationFrame:frame=>{mappingCalls.push(frame);return mapNarrationFrame(frame);}};
  if(name==='./V9ArticulatedVisual')return {V9ArticulatedVisual:visualSentinel};
  return req(name);
};
mocked._compile(transformed.code,filename);
for(currentFrame=0;currentFrame<720;currentFrame++){
  const result=mocked.exports.Episode1V10FinalProof();
  const children=result.props.children.flat();
  const visual=children.filter(child=>child?.type===visualSentinel);
  assert.equal(visual.length,1);assert.equal(visual[0].props.frame,expectedFrame(currentFrame));
  assert.equal(visual[0].props.finalRuleSize,50);
  const audio=children.filter(child=>child?.type==='test-audio');
  assert.equal(audio.length,1);assert.equal(audio[0].props.src,'audio/episode1-narration.mp3');
  assert.equal(audio[0].props.volume,1);
}
assert.deepEqual(mappingCalls,Array.from({length:720},(_,i)=>i));
console.log('PASS: 720 historical V9 markup frames unchanged; 720 independent fixed mapping/scene expectations; arithmetic cue coverage; clamps; 720 mocked real V10 component calls; canonical narration path; V10-only 50px override. No browser pixels, audio listening or artistic acceptance tested.');

