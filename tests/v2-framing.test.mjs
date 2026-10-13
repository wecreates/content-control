import test from 'node:test';
import assert from 'node:assert/strict';
import {v2FrameActor} from '../remotion/V2CameraPerformance.mjs';
import {v2SceneActor} from '../remotion/StudioLayout.mjs';
test('close actor framing preserves planted feet and all held contacts',()=>{
 for(const beat of ['amex-counter','final-clash','trap'])for(const id of ['dave','cashback_goblin','points_monk']){
  const old=v2SceneActor(beat,id,0,2),framed=v2FrameActor(beat,old);
  assert.ok(framed.scale>old.scale);
  assert.ok(Math.abs(old.y+152*old.scale-framed.y-152*framed.scale)<1e-9);
  for(const key of ['leftHandTarget','rightHandTarget'])if(old[key])for(const axis of ['x','y']){
   assert.ok(Math.abs(old[axis]+old.scale*old[key][axis]-framed[axis]-framed.scale*framed[key][axis])<1e-9);
  }
 }
});
test('wide action beats retain original geometry, giving meaningful framing contrast',()=>{
 const slot=v2SceneActor('cold-open','dave',0,1);
 assert.deepEqual(v2FrameActor('cold-open',slot),slot);
 assert.notEqual(v2FrameActor('trap',slot),slot);
});
test('finish framing keeps the head below the entire sandwich payoff',()=>{
 const slot=v2FrameActor('finish',v2SceneActor('finish','dave',0,1));
 // Dave head extends 124 local pixels above the origin. Sandwich lower bound
 // at the start of finish is 610 + 32*.58; allow another 12px for motion/stroke.
 assert.ok(slot.y-124*slot.scale > 610+32*.58+12);
});
