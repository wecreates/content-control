import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
const result=await build({entryPoints:['remotion/V2StageEnvironment.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const {V2StageEnvironment}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const draw=beat=>renderToStaticMarkup(React.createElement(V2StageEnvironment,{beat}));
test('story beats establish arena, lounge, checkpoint and victory settings',()=>{
 const expected={'cold-open':'arena','chase-strike':'arena','fee-drain':'arena','amex-counter':'snack-lounge','points-summon':'snack-lounge','trap':'value-checkpoint','final-clash':'value-checkpoint',finish:'victory-platform'};
 for(const [beat,setting] of Object.entries(expected)){
  const svg=draw(beat);assert.ok(svg.includes(`data-v2-setting="${setting}"`));
  assert.ok(!svg.includes('<text'),'background does not add competing readable labels');
  assert.ok(!svg.includes('<image'),'settings have no external asset dependency');
 }
 assert.equal(draw('unsupported'),'');
 assert.notEqual(draw('amex-counter'),draw('points-summon'),'table relocates away from center actor');
 assert.notEqual(draw('trap'),draw('final-clash'),'checkpoint outcome has a visible passed marker');
});
test('scene setting is rendered behind all primary props',async()=>{
 const r=await build({entryPoints:['remotion/V2BattleAction.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
 const {V2BattleAction}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
 const scene={id:'cold-open-a',start:0,end:1};
 const svg=renderToStaticMarkup(React.createElement(V2BattleAction,{scene,scenes:[scene],time:.5}));
 assert.ok(svg.indexOf('data-v2-setting')<svg.indexOf('CHASE'));
});
