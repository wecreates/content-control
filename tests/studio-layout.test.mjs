import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fitText,normalizePropId,normalizePose,characterSlots,propSlots} from '../remotion/StudioLayout.mjs';
test('trap button label matches the spoken bad idea setup',()=>{
 const action=fs.readFileSync(new URL('../remotion/V2BattleAction.jsx',import.meta.url),'utf8');
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 const lines=c.scenes.filter(s=>s.id.startsWith('trap-')).flatMap(s=>s.audio?.dialogue||[]).map(x=>x.text).join(' ');
 assert.match(lines,/button say bad idea/i);
 assert.ok(action.includes('<Button x={210} label="BAD IDEA" pressed={p>.12}/>'));
 assert.ok(!action.includes('PANIC TAP'));
});
test('V2 portrait framing preserves actor-prop contacts and readable captions',async()=>{
 const {V2_STAGE_FRAMING:f,v2StageTransform,fitCaption,captionTextWidth,v2BattleBeat}=await import('../remotion/StudioLayout.mjs');
 assert.equal(f.scale,1.06);assert.equal(f.targetY-f.sourceY,100);
 assert.match(v2StageTransform(),/^translate\(360 790\) scale\(1.06\)/);
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 for(const beat of new Set(c.scenes.map(s=>v2BattleBeat(s.id)))){
  const text=c.scenes.filter(s=>v2BattleBeat(s.id)===beat).flatMap(s=>s.audio?.dialogue||[]).map(x=>x.text).join(' ');
  const layout=fitCaption(text,592,175,f.captionSize);
  assert.equal(layout.lines.join(' '),text);
  assert.ok(layout.lines.every(line=>captionTextWidth(line,layout.size)<=544));
  assert.ok(layout.lines.length*layout.lineHeight<=175);
  assert.ok(layout.size>=34,'larger preferred captions must not shrink below prior size');
 }
 const source=fs.readFileSync(new URL('../remotion/StudioAnimaticComposition.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("background:'#fff'"));
 assert.ok(source.includes('transform={battle?v2StageTransform():undefined}'));
});
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
 const monk=v2SceneActor('chase-strike','points_monk',0,1);assert.equal(monk.x+monk.leftHandTarget.x,528);assert.equal(monk.y+monk.leftHandTarget.y,560);assert.ok(monk.x>590&&monk.y>700);
});

