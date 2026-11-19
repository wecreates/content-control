import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {mapNarrationFrame,frameSpans} from '../preview/v10-narration-candidate/NarrationFrameMap.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(path.join(root,'package.json'));
const esbuild=req('esbuild');const {renderToStaticMarkup}=req('react-dom/server');
const source=(which)=>path.join(root,which==='base'?'tests/fixtures/v10-source-before/V9ArticulatedVisual.jsx':which==='canonical'?'remotion/V9ArticulatedVisual.jsx':'preview/v10-narration-candidate/PreviewArticulatedVisual.jsx');
async function getVisual(which){const src=fs.readFileSync(source(which),'utf8');const result=await esbuild.transform(src,{loader:'jsx',format:'cjs'});const filename=path.join(root,'remotion/__test_'+which+'.cjs');const m=new Module(filename);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(result.code,filename);return which==='proposed'?m.exports.PreviewArticulatedVisual:m.exports.V9ArticulatedVisual;}
const old=await getVisual('base');const canonical=await getVisual('canonical');const newer=await getVisual('proposed');
for(let frame=0;frame<720;frame++){assert.equal(renderToStaticMarkup(old({frame})),renderToStaticMarkup(canonical({frame})));assert.equal(renderToStaticMarkup(old({frame})),renderToStaticMarkup(newer({frame})));assert(mapNarrationFrame(frame)>=0&&mapNarrationFrame(frame)<720);}
assert(renderToStaticMarkup(newer({frame:719,finalRuleSize:50})).includes('font-size="50"'));
for(const [start,end,source] of frameSpans){assert.equal(mapNarrationFrame(start),source);assert(mapNarrationFrame(end-1)<=source+59);}
for(let f=660;f<720;f++)assert.equal(mapNarrationFrame(f),719);
const v10=fs.readFileSync(path.join(root,'preview/v10-narration-candidate/Episode1V10NarrationCandidate.jsx'),'utf8');assert(v10.includes('staticFile("audio/episode1-narration.mp3")'));assert(v10.includes('finalRuleSize={50}'));assert(!v10.includes('episode1-music'));assert(!v10.includes('episode1-sfx'));await esbuild.transform(v10,{loader:'jsx'});

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
  if(name==='./PreviewArticulatedVisual')return {PreviewArticulatedVisual:visualSentinel};
  return req(name);
};
mocked._compile(transformed.code,filename);
for(currentFrame=0;currentFrame<720;currentFrame++){
  const result=mocked.exports.Episode1V10NarrationCandidate();
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


// Exact production bytes verified against live main bc5e538111d3a8e0efcbff541cc73366edbef9f3.
const canonicalHashes={"remotion/Episode1V10FinalProof.jsx": "e3ce2d17ff231aba92ea59e824c87bef285ff1934d963db4742ca96eb81d5b8d", "remotion/V9ArticulatedVisual.jsx": "95f25034a847d9a5858df43ce2a41bbbb5de811e5437e0e6e6651efdaaa58bdc", "remotion/v10-index.jsx": "1a709f31a504b2514eac01e54dfde60f5831855ca64039eaf125c7db7cbcaaf2", "state/episode1-factual-contract.json": "1ccdfbdb9111b9c91d501e9d44d2e849c55f29a81e2b5fe100bf66b843de93a8"};
for(const [name,expected] of Object.entries(canonicalHashes)){assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root,name))).digest("hex"),expected,`canonical source changed: ${name}`);}
const production=fs.readFileSync(path.join(root,"remotion/Episode1V10FinalProof.jsx"),"utf8");
assert(production.includes("episode1-music.mp3"));assert(production.includes("episode1-sfx-1.mp3"));assert(!production.includes("NarrationFrameMap"));
const entry=fs.readFileSync(path.join(root,"preview/v10-narration-candidate/index.jsx"),"utf8");
assert(entry.includes("id=\"Episode1V10NarrationCandidate\""));assert(entry.includes("durationInFrames={720}"));assert(!fs.readFileSync(path.join(root,"remotion/v10-index.jsx"),"utf8").includes("preview"));
const canonicalContract=JSON.parse(fs.readFileSync(path.join(root,"state/episode1-factual-contract.json")));
const draftContract=JSON.parse(fs.readFileSync(path.join(root,"preview/v10-narration-candidate/episode1-factual-contract.draft.json")));
assert.equal(canonicalContract.narration_sha256,"77ae2168527509c49a02ab08d9e54f8c04fd5774309bba82e8eefa88974074fb");
assert.equal(draftContract.narration_sha256,"c2b633f1c509fec43be6fd75d365b6335ca273e8beb6be6c5552bbb3cd24cd57");
console.log("PASS: canonical V10/V9/entrypoint/contract bytes unchanged; isolated preview composition and draft contract only.");
