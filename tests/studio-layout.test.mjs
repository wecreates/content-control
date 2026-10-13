import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fitText,normalizePropId,normalizePose,characterSlots,propSlots} from '../remotion/StudioLayout.mjs';
test('all current V2 headlines fit without truncating words',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 for(const scene of c.scenes){const title=scene.story.beat;const l=fitText(title,592,144);assert.equal(l.lines.join(' '),title);assert.ok(l.lines.every(x=>x.length*l.size<=592));assert.ok(l.lines.length*l.lineHeight<=144);}
});
test('current unsupported asset aliases resolve intentionally',()=>{
 assert.equal(normalizePropId('score_meter'),'score_gauge');
 assert.equal(normalizePose('points_monk','point'),'deadpan_point');
 assert.equal(normalizePose('cashback_goblin','recoil'),'ankle_drag');
});
test('stage rejects overcrowding and separates actor/prop regions',()=>{
 assert.throws(()=>characterSlots(4));assert.throws(()=>propSlots(5));
 for(let n=1;n<=3;n++)for(const c of characterSlots(n)){assert.ok(c.x-c.scale*105>=60);assert.ok(c.x+c.scale*105<=660);assert.ok(c.y-c.scale*150>580);assert.ok(c.y+c.scale*170<1080);}
 for(let n=1;n<=4;n++)for(const p of propSlots(n)){assert.ok(p.x-p.scale*130>=60);assert.ok(p.x+p.scale*130<=660);assert.ok(p.y+p.scale*120<560);}
});
test('V2 battle has real changing SVG actions across all original story beats',async()=>{
 const {build}=await import('esbuild');
 const {renderToStaticMarkup}=await import('react-dom/server');
 const React=await import('react');
 const result=await build({entryPoints:['remotion/V2BattleAction.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
 const {V2BattleAction,v2WalletMotion}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 assert.ok(v2WalletMotion('finish',0).y>v2WalletMotion('finish',.32).y);
 assert.ok(v2WalletMotion('trap',.5).rotation< -20);
 assert.ok(Math.abs(v2WalletMotion('trap',1).rotation)<1e-10);
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 const {v2BattleBeat}=await import('../remotion/StudioLayout.mjs');
 for(const prefix of new Set(c.scenes.map(s=>v2BattleBeat(s.id)))){
  assert.ok(prefix);const scenes=c.scenes.filter(s=>v2BattleBeat(s.id)===prefix),start=scenes[0].start,end=scenes.at(-1).end;
  const render=time=>renderToStaticMarkup(React.createElement(V2BattleAction,{scene:scenes[0],scenes:c.scenes,time}));
  const a=render(start),b=render(end-.01);
  assert.match(a,/data-v2-beat/);
  assert.notEqual(a,b,`${prefix} must visibly change`);
  assert.ok(!a.includes('score_meter'));
 }
});
test('victory gesture stays inside the character stage and does not reset per cut',async()=>{
 const {v2VictoryPose}=await import('../remotion/StudioLayout.mjs');
 for(let i=0;i<=100;i++){const m=v2VictoryPose(i/100);assert.ok(m.bob>=-30&&m.bob<=0);assert.ok(m.arm>=28&&m.arm<=68);assert.equal(m.mood,'smile');}
 assert.notDeepEqual(v2VictoryPose(.45),v2VictoryPose(.55));
});
test('V2 characters are staged for specific props instead of repeated center pose',async()=>{
 const {v2SceneActor}=await import('../remotion/StudioLayout.mjs');
 const cold=v2SceneActor('cold-open','dave',0,1),sword=v2SceneActor('chase-strike','points_monk',0,1);
 assert.notEqual(cold.x,sword.x);
 assert.ok(cold.rightHandTarget.y<0);
 const left=v2SceneActor('final-clash','cashback_goblin',0,2),right=v2SceneActor('final-clash','points_monk',1,2);
 assert.ok(left.x<260&&right.x>460);
 assert.ok(Math.abs(left.x+left.rightHandTarget.x*left.scale-260)<10);
 assert.ok(Math.abs(right.x+right.leftHandTarget.x*right.scale-460)<10);
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 for(const s of c.scenes)for(const line of s.audio?.dialogue||[]){const layout=fitText(line.text,592,175,34);assert.equal(layout.lines.join(' '),line.text);}
});
test('V2 captions preserve every word with weighted glyph bounds and padding',async()=>{
 const {fitCaption,captionTextWidth,v2SceneActor}=await import('../remotion/StudioLayout.mjs');
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 for(const s of c.scenes)for(const line of s.audio?.dialogue||[]){const l=fitCaption(line.text);assert.equal(l.lines.join(' '),line.text);assert.ok(l.lines.every(x=>captionTextWidth(x,l.size)<=544));assert.ok(l.lines.length*l.lineHeight<=175);}
 const monk=v2SceneActor('chase-strike','points_monk',0,1);assert.equal(monk.x+monk.leftHandTarget.x*monk.scale,528);assert.equal(monk.y+monk.leftHandTarget.y*monk.scale,560);assert.ok(monk.x>560&&monk.y>740);
});

test('rendered victory hand inputs preserve moving gesture instead of fixed prop contact',async()=>{
 const {v2VictoryPose,v2SceneActor,resolveBattleHandTargets}=await import('../remotion/StudioLayout.mjs');
 const slot=v2SceneActor('finish','dave',0,1);
 const start=resolveBattleHandTargets(v2VictoryPose(0),slot,{freeGesture:true});
 const raised=resolveBattleHandTargets(v2VictoryPose(.35),slot,{freeGesture:true});
 assert.equal(start.leftHandTarget.y,-10);
 assert.equal(raised.leftHandTarget.y,-90);
 assert.notDeepEqual(raised.leftHandTarget,slot.leftHandTarget);
 assert.equal(raised.rightHandTarget.y,raised.leftHandTarget.y);
});
test('prop contact remains fixed in world coordinates through bob and lean',async()=>{
 const {resolveBattleHandTargets}=await import('../remotion/StudioLayout.mjs');
 for(const lean of [-30,0,27])for(const bob of [-25,0,18]){
  const slot={x:360,y:755,scale:1.05,leftHandTarget:{x:-55,y:-184},rightHandTarget:{x:55,y:-184}};
  const hands=resolveBattleHandTargets({lean,bob},slot),a=lean*Math.PI/180;
  for(const key of ['leftHandTarget','rightHandTarget']){
   const h=hands[key];
   assert.ok(Math.abs(slot.x+slot.scale*(h.x*Math.cos(a)-h.y*Math.sin(a))-(slot.x+slot.scale*slot[key].x))<1e-9);
   assert.ok(Math.abs(slot.y+bob+slot.scale*(h.x*Math.sin(a)+h.y*Math.cos(a))-(slot.y+slot.scale*slot[key].y))<1e-9);
  }
 }
});

test('V2 eyes track the action without escaping face bounds and blink over time',async()=>{
 const {v2FacePerformance}=await import('../remotion/V2FacePerformance.mjs');
 const {v2SceneActor}=await import('../remotion/StudioLayout.mjs');
 const slot=v2SceneActor('fee-drain','dave',0,1);
 const face=time=>v2FacePerformance({id:'dave',beat:'fee-drain',time,start:11.75,end:16.5,slot,motion:{lean:-10,bob:3}});
 for(let t=11.75;t<16.5;t+=1/24){const f=face(t);assert.ok(f.gazeX>0&&f.gazeX<=3);assert.ok(f.gazeY>=-2&&f.gazeY<=2);assert.ok(f.blink>=0&&f.blink<=1);assert.ok(f.browLift>=1&&f.browLift<=2);}
 assert.ok(face(13.9).blink<.01);assert.equal(face(14.2).blink,1);
});
test('panic and gaze controls change actual shared character SVG',async()=>{
 const {build}=await import('esbuild');const {renderToStaticMarkup}=await import('react-dom/server');const React=await import('react');
 const result=await build({entryPoints:['remotion/CharacterSystem.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
 const {Dave}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const draw=props=>renderToStaticMarkup(React.createElement(Dave,{x:0,y:0,label:'',...props}));
 const panic=draw({mood:'panic'}),smile=draw({mood:'smile'});
 assert.notEqual(panic,smile);assert.ok(!panic.includes('M-14 12 Q0 24 14 12'));
 assert.notEqual(panic,draw({mood:'panic',gazeX:3,gazeY:-2,blink:.12,browLift:4}));
});

import {speechMouthActivity,v2FacePerformance} from '../remotion/V2FacePerformance.mjs';
const caption={speaker:'dave',start:1,end:2};
test('only the observed on-screen speaker moves within the spoken window',()=>{
 for(const id of ['dave','points_monk','cashback_goblin']){
  const c={...caption,speaker:id};assert.ok(speechMouthActivity(id,1.4,c)>0);
  for(const t of [0,1,2,3])assert.equal(speechMouthActivity(id,t,c),0);
  for(const other of ['narrator','offscreen','unknown'])assert.equal(speechMouthActivity(id,1.4,{...c,speaker:other}),0);
 }
 assert.equal(speechMouthActivity('points_monk',1.4,caption),0);
 for(const c of [null,{...caption,start:NaN},{...caption,end:1},{...caption,start:'1'}])assert.equal(speechMouthActivity('dave',1.4,c),0);
});
test('speech envelope is deterministic bounded and smoothly enters/exits',()=>{
 for(let t=1;t<=2;t+=1/240){const x=speechMouthActivity('dave',t,caption);assert.ok(x>=0&&x<=1);assert.equal(x,speechMouthActivity('dave',t,caption));}
 assert.ok(speechMouthActivity('dave',1.001,caption)<.001);assert.ok(speechMouthActivity('dave',1.999,caption)<.001);
 const args={id:'dave',beat:'finish',time:1.4,start:1,end:2,slot:{x:200,y:550,scale:1,mood:'smile'}};
 const silent=v2FacePerformance(args),spoken=v2FacePerformance({...args,observedCaption:caption});assert.ok(spoken.mouthOpen>0);
 for(const key of ['gazeX','gazeY','blink','browLift'])assert.equal(silent[key],spoken[key]);
});
test('all complete character SVGs preserve rest moods and render speech aperture',async()=>{
 const {build}=await import('esbuild');const {renderToStaticMarkup}=await import('react-dom/server');const React=await import('react');
 const result=await build({entryPoints:['remotion/CharacterSystem.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
 const chars=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 for(const name of ['Dave','PointsMonk','CashbackGoblin'])for(const mood of ['smile','panic','shock','deadpan','mad']){
  const draw=props=>renderToStaticMarkup(React.createElement(chars[name],{x:200,y:600,label:'',mood,...props}));
  const rest=draw({});assert.equal(rest,draw({mouthOpen:0}));assert.notEqual(rest,draw({mouthOpen:.8}));assert.equal(rest,draw({mouthOpen:NaN}));
  assert.ok(!draw({mouthOpen:.8}).includes('NaN'));assert.ok(draw({mouthOpen:.8}).includes('data-speech-mouth="true"'));
 }
});
test('composition routes observed speech only to the matching visible character',async()=>{
 const {build}=await import('esbuild');const {renderToStaticMarkup}=await import('react-dom/server');const React=await import('react');
 const result=await build({entryPoints:['remotion/StudioAnimaticComposition.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixed-frame',setup(build){build.onResolve({filter:/^remotion$/},()=>({path:'runtime',namespace:'fixed-frame'}));build.onLoad({filter:/.*/,namespace:'fixed-frame'},()=>({contents:'export const useCurrentFrame=()=>204; export const useVideoConfig=()=>({fps:24}); export const AbsoluteFill=({children})=>children;',loader:'js'}));}}]});
 const {StudioAnimaticComposition}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const original=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 // At 8.5s both Monk and Goblin are visible; only Monk speaks in this fixture.
 const draw=speaker=>{const c=structuredClone(original);c.caption_track={status:'PASS',publication_enabled:false,cues:[{start:8,end:9,text:'A spoken word',speaker}]};return renderToStaticMarkup(React.createElement(StudioAnimaticComposition,{ccsd:c}));};
 const spoken=draw('points_monk'),narrated=draw('narrator');
 const caption=spoken.match(/<text x="360" y="230"[^>]*>/)?.[0];
 assert.ok(caption?.includes('font-size="72"'),'V2 spoken captions use the phone-readable preferred size');
 assert.equal((spoken.match(/data-speaking-mouth="true"/g)||[]).length,1);
 assert.equal((spoken.match(/data-speaking-mouth="false"/g)||[]).length,1);
 assert.equal((narrated.match(/data-speaking-mouth="true"/g)||[]).length,0);
});


test('V2 camera stays continuous across editorial cuts sharing one move',async()=>{
 const {v2CameraProgress}=await import('../remotion/V2CameraPerformance.mjs');
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 let checked=0;
 for(let i=1;i<c.scenes.length;i++){
  const a=c.scenes[i-1],b=c.scenes[i];
  const {v2BattleBeat}=await import('../remotion/StudioLayout.mjs');
  if(v2BattleBeat(a.id)!==v2BattleBeat(b.id)||a.camera.move!==b.camera.move)continue;
  const before=v2CameraProgress(c.scenes,a,b.start-1e-6),after=v2CameraProgress(c.scenes,b,b.start);
  assert.ok(Math.abs(after-before)<1e-5);assert.ok(after>0&&after<1);checked++;
 }
 assert.ok(checked>=4,'actual repeated punch-in cuts were exercised');
 const scenes=[{id:'trap-a-1',start:0,end:1,camera:{move:'punch_in'}},{id:'trap-a-2',start:1,end:2,camera:{move:'tracking'}}];
 assert.equal(v2CameraProgress(scenes,scenes[1],1),0,'explicit camera change starts a new move');
 scenes[1].camera.move='punch_in';scenes[1].start=1.5;
 assert.equal(v2CameraProgress(scenes,scenes[1],1.5),0,'timeline gaps do not merge moves');
});


test('larger V2 captions retain every word within the existing text reserve',async()=>{
 const {fitCaption,captionTextWidth}=await import('../remotion/StudioLayout.mjs');
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 const texts=['stops','the winning',...c.scenes.flatMap(scene=>(scene.audio?.dialogue||[]).map(line=>line.text))];
 for(const text of texts){
  const layout=fitCaption(text,592,175,52);
  assert.equal(layout.lines.join(' '),text.trim().replace(/\s+/g,' '));
  assert.ok(layout.lines.every(line=>captionTextWidth(line,layout.size)<=544));
  assert.ok(layout.lines.length*layout.lineHeight<=175);
 }
 assert.equal(fitCaption('stops',592,175,52).size,52);
});


test('V2 editorial cuts do not retrigger physical impact rays or camera shake',async()=>{
 const {v2ImpactAmount}=await import('../remotion/V2CameraPerformance.mjs');
 const {v2BattleBeat}=await import('../remotion/StudioLayout.mjs');
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 let continuations=0;
 for(let i=0;i<c.scenes.length;i++){
  const scene=c.scenes[i],samePrevious=i>0&&v2BattleBeat(c.scenes[i-1].id)===v2BattleBeat(scene.id);
  if(samePrevious){assert.equal(v2ImpactAmount(c.scenes,scene,scene.start),0);continuations++;}
  else {assert.equal(v2ImpactAmount(c.scenes,scene,scene.start),1);assert.ok(Math.abs(v2ImpactAmount(c.scenes,scene,scene.start+.15)-.5)<1e-8);}
 }
 assert.equal(continuations,16);
 const first=c.scenes[0];assert.equal(v2ImpactAmount(c.scenes,{...first,fx:[]},first.start),0);
});


test('Dave physically taps PANIC TAP then returns to wallet grip',async()=>{
 const {v2TrapTapHand}=await import('../remotion/StudioLayout.mjs');
 const grip={x:305,y:571};
 assert.deepEqual(v2TrapTapHand(0,grip),grip);
 for(const p of [.12,.14,.17])assert.deepEqual(v2TrapTapHand(p,grip),{x:210,y:423});
 assert.deepEqual(v2TrapTapHand(.32,grip),grip);
 assert.deepEqual(v2TrapTapHand(1,grip),grip);
 for(let p=0;p<=1;p+=1/240){const hand=v2TrapTapHand(p,grip);assert.ok(hand.x>=210&&hand.x<=305);assert.ok(hand.y>=423&&hand.y<=571);}
 assert.ok(Math.abs(v2TrapTapHand(.11999,grip).x-v2TrapTapHand(.12001,grip).x)<.001);
});
