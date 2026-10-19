import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transitionStyle} from '../remotion/SceneTransitions.mjs';

// SYNTHETIC timing fixtures only; no candidate-media or creative approval.
test('entrance remains active while the same-type exit is inactive',()=>{
 for(const type of ['whip_pan','zoom_through','object_wipe','coin_iris','prop_collision']){
  const entrance=transitionStyle({type,frames:6},0,48,false);
  const exit=transitionStyle({type,frames:6},0,48,true);
  assert.notDeepEqual(entrance,exit);
  // Demonstrates why flattening these styles loses the entrance.
  assert.deepEqual({...entrance,...exit},exit);
 }
});
test('timing preserves deliberate transition shapes and clamps outside windows',()=>{
 const t={type:'whip_pan',frames:6};
 assert.equal(transitionStyle(t,0,48).transform,'translateX(110%)');
 assert.equal(transitionStyle(t,3,48).transform,'translateX(55%)');
 assert.equal(transitionStyle(t,6,48).transform,'translateX(0%)');
 assert.equal(transitionStyle(t,42,48,true).transform,'translateX(0%)');
 assert.equal(transitionStyle(t,45,48,true).transform,'translateX(55%)');
 assert.equal(transitionStyle(t,48,48,true).transform,'translateX(110%)');
 assert.deepEqual(transitionStyle({type:'cut'},0,48),{});
});
test('overlapping short-scene entrance and exit retain independent opacity',()=>{
 const t={type:'zoom_through',frames:6};
 const a=transitionStyle(t,2,4),b=transitionStyle(t,2,4,true);
 assert.ok(a.opacity<1&&b.opacity<1);
 assert.ok(a.opacity*b.opacity<Math.min(a.opacity,b.opacity));
});
test('both renderers nest exit, entrance and camera instead of overwriting styles',()=>{
 for(const name of ['ReferenceCloneComposition','ReferenceCloneLongComposition']){
  const s=readFileSync(new URL(`../remotion/${name}.jsx`,import.meta.url),'utf8');
  assert.match(s,/\.\.\.exit\}\}>\s*<div[^\n]+\.\.\.entrance\}\}>\s*<div[^\n]+transform:camera/);
  assert.doesNotMatch(s,/const transition=|transform:camera[^\n]+\.\.\./);
 }
});
