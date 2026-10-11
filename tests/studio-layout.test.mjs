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
 const {V2BattleAction}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const c=JSON.parse(fs.readFileSync(new URL('../projects/v2/amex-vs-chase-boss-fight/ccsd.json',import.meta.url)));
 const {v2BattleBeat}=await import('../remotion/StudioLayout.mjs');
 for(const prefix of new Set(c.scenes.map(s=>v2BattleBeat(s.id)))){
  assert.ok(prefix);const scenes=c.scenes.filter(s=>v2BattleBeat(s.id)===prefix),start=scenes[0].start,end=scenes.at(-1).end;
  const render=time=>renderToStaticMarkup(React.createElement(V2BattleAction,{scene:scenes[0],scenes:c.scenes,time}));
  const a=render(start),b=render(end-.01);
  assert.match(a,/CHASE/);assert.match(a,/AMEX/);
  assert.notEqual(a,b,`${prefix} must visibly change`);
  assert.ok(!a.includes('score_meter'));
 }
});
