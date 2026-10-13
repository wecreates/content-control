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

test('Goblin cape grip follows the actual rotating lower hem throughout the beat',async()=>{
 const {v2CapeMotion,v2CapeGrip}=await import('../remotion/StudioLayout.mjs');
 for(let frame=0;frame<=120;frame++){
  const p=frame/120,c=v2CapeMotion(p),grip=v2CapeGrip(p),a=c.rotation*Math.PI/180;
  assert.ok(Math.abs(grip.x-(c.x-c.s*95*Math.sin(a)))<1e-9);
  assert.ok(Math.abs(grip.y-(c.y+c.s*95*Math.cos(a)))<1e-9);
  const slot=v2SceneActor('amex-counter','cashback_goblin',0,2);
  slot.rightHandTarget={x:(grip.x-slot.x)/slot.scale,y:(grip.y-slot.y)/slot.scale};
  for(const lean of [-12,18]){
   const bob=-14,hand=resolveBattleHandTargets({lean,bob},slot).rightHandTarget,r=lean*Math.PI/180;
   assert.ok(Math.abs(slot.x+slot.scale*(hand.x*Math.cos(r)-hand.y*Math.sin(r))-grip.x)<1e-9);
   assert.ok(Math.abs(slot.y+bob+slot.scale*(hand.x*Math.sin(r)+hand.y*Math.cos(r))-grip.y)<1e-9);
  }
 }
});

test('upper cards clear the largest observed two-line caption after camera zoom',async()=>{
 const {build}=await import('esbuild'),{renderToStaticMarkup}=await import('react-dom/server'),React=await import('react');
 const result=await build({entryPoints:['remotion/V2BattleAction.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
 const {V2BattleAction}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 for(const beat of ['cold-open','chase-strike'])for(const time of [0,.5,1]){
  const scene={id:beat+'-a',start:0,end:1};
  const svg=renderToStaticMarkup(React.createElement(V2BattleAction,{scene,scenes:[scene],time}));
  const cards=[...svg.matchAll(/translate\(([-.\d]+) ([-.\d]+)\) rotate\(([-.\d]+)\)"\><rect x="-87"/g)];
  assert.equal(cards.length,2);
  for(const card of cards){
   const y=Number(card[2]),a=Number(card[3])*Math.PI/180;
   const top=y-87*Math.abs(Math.sin(a))-42*Math.abs(Math.cos(a))-2.5;
   const zoomed=690+(top-690)*1.035;
   assert.ok(zoomed>=360,`actual card outline at ${zoomed} clears caption bottom339.2`);
  }
 }
});
