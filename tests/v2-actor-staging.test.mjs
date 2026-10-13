import test from 'node:test';
import assert from 'node:assert/strict';
import {v2SceneActor,resolveBattleHandTargets} from '../remotion/StudioLayout.mjs';
const cases=[
 ['cold-open','dave',0,1,'rightHandTarget',275.8,559],
 ['chase-strike','points_monk',0,1,'leftHandTarget',528,560],
 ['fee-drain','dave',0,1,'rightHandTarget',245,565],
 ['points-summon','points_monk',0,1,'leftHandTarget',260,605],
 ['points-summon','points_monk',0,1,'rightHandTarget',470,595],
 ['amex-counter','cashback_goblin',0,2,'rightHandTarget',223.25,573.25],
 ['amex-counter','points_monk',1,2,'leftHandTarget',473,502],
 ['final-clash','cashback_goblin',0,2,'rightHandTarget',265.75,517],
 ['final-clash','points_monk',1,2,'leftHandTarget',454.25,517],
];
test('larger performers retain the existing physical prop contacts through motion',()=>{
 for(const [beat,id,index,count,key,x,y] of cases){
  const slot=v2SceneActor(beat,id,index,count);
  assert.ok(slot.scale>=1.3);
  for(const lean of [-12,0,18])for(const bob of [-16,0,14]){
   const hand=resolveBattleHandTargets({lean,bob},slot)[key],a=lean*Math.PI/180;
   assert.ok(Math.abs(slot.x+slot.scale*(hand.x*Math.cos(a)-hand.y*Math.sin(a))-x)<1e-9,beat);
   assert.ok(Math.abs(slot.y+bob+slot.scale*(hand.x*Math.sin(a)+hand.y*Math.cos(a))-y)<1e-9,beat);
  }
 }
});
test('enlarged actors retain lower-stage foot room and clear the caption reserve',()=>{
 for(const [beat,id,index,count] of [...cases,['trap','dave',0,1],['finish','dave',0,1]]){
  const s=v2SceneActor(beat,id,index,count);
  const head=id==='cashback_goblin'?110:128,foot=id==='points_monk'?184:id==='cashback_goblin'?136:174;
  assert.ok(s.y-head*s.scale>410,`${beat} head clears caption region`);
  assert.ok(s.y+foot*s.scale<1120,`${beat} feet stay above lower UI reserve`);
 }
});
