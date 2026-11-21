import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedBeatState,localHand} from '../remotion/V2GroundedLayout.mjs';
import {PREVIEW_TEXT_TEAL,previewAccentWord,previewWordSelected} from '../remotion/V2StylePreview.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('plated sandwiches stay on their supporting plane over the complete beats',()=>{
 for(const beat of ['fee-drain','points-summon','finish'])for(let frame=0;frame<=150;frame++){
  const g=groundedBeatState(beat,frame/150);
  near(g.snack.y+32*g.snack.s,g.shot==='budget-table-detail'?837:g.surfaceY-13);
  assert.ok(g.snack.x-56*g.snack.s>30&&g.snack.x+56*g.snack.s<690);
  if(beat==='finish')near(g.wallet.y+66*g.wallet.s,g.shot==='budget-table-detail'?850:g.surfaceY);
 }
});
test('receiving hand follows actual moving envelope edge without source rig drift',()=>{
 for(let frame=0;frame<=129;frame++){
  const g=groundedBeatState('points-summon',frame/129),local=localHand(g.actor,g.envelopeGrip);
  near(g.actor.x+local.x*g.actor.scale,g.envelope.x-78*g.envelope.s);
  near(g.actor.y+local.y*g.actor.scale,g.envelope.y+12*g.envelope.s);
  near(g.actor.y+150*g.actor.scale,1100);
  assert.ok(g.envelope.x+78*g.envelope.s<690);
 }
});
test('fee grip remains on wallet and detail insert is an authored layout change',()=>{
 for(let f=0;f<=114;f++){
  const g=groundedBeatState('fee-drain',f/114),local=localHand(g.actor,g.walletGrip);
  near(g.actor.x+local.x*g.actor.scale,g.wallet.x-45*g.wallet.s);
  near(g.actor.y+local.y*g.actor.scale,g.wallet.y+66*g.wallet.s);
  assert.ok(g.actor.x-36*g.actor.scale>30);
 }
 assert.notEqual(groundedBeatState('fee-drain',.49).shot,groundedBeatState('fee-drain',.51).shot);
 assert.equal(groundedBeatState('finish',.6).shot,'budget-table-detail');
 assert.equal(groundedBeatState('finish',.9).shot,'budget-reaction');
});
test('text derivative exceeds 4.5:1 without relying on an outline',()=>{
 const rgb=PREVIEW_TEXT_TEAL.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 const luminance=rgb.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 assert.ok(1.05/(luminance+.05)>=4.5);
});
test('accent selection uses existing exact words, including punctuation',()=>{
 for(const text of ['The snacks arrived.','with tiny sandwiches?','choosing a budget.']){
  const words=text.split(/(\s+)/),selected=previewAccentWord(text);
  assert.equal(words.join(''),text);assert.equal(words.filter(w=>previewWordSelected(w,selected)).length,1);
 }
 assert.equal(previewAccentWord('only invited one.'),null);
 assert.equal(groundedBeatState('not-a-v2-beat',.5),null);
});
