import test from 'node:test';import assert from 'node:assert/strict';import {openingTiming,openingPose} from '../remotion/LongOpeningMotion.mjs';
const timing={impact:1.66,closeEnd:2.62,heroEnd:5.025,end:7.958333333333333};
test('table only deforms after observed word impact and never resets at scene cuts',()=>{
 assert.equal(openingPose(1.65,timing).dent,0);
 assert.ok(openingPose(1.8,timing).dent>17);
 assert.ok(openingPose(2.3,timing).dent>=openingPose(1.8,timing).dent);
});
test('card contact is physically tied to deformed tabletop',()=>{
 const p=openingPose(2.2,timing);
 assert.ok(Math.abs((p.cardY+55*1.35)-(510+p.dent))<1);
});
test('motion stays finite with no repeated slam and readable caption safe zone',()=>{
 for(let time=0;time<timing.end;time+=1/240){
 const p=openingPose(time,timing);
 for(const v of Object.values(p))if(typeof v==='number')assert.ok(Number.isFinite(v));
 if(p.shot==='impact-closeup'){assert.ok(p.cardY-100>180);assert.ok(p.cardY+90<570);}
 }
 assert.equal(openingPose(3,timing).shot,'hero-low-angle');assert.equal(openingPose(6,timing).shot,'reaction-medium');
});
test('observed caption words drive hook timing without altering audio or captions',()=>{
 const doc={scenes:[{id:'scene-003',start:5.375},{id:'scene-005',start:7.958}],caption_track:{cues:[{scene_id:'scene-000',word:'dented',start:1.8},{scene_id:'scene-000',word:'table.',end:2.7}]}};
 const before=JSON.stringify(doc),t=openingTiming(doc);
 assert.equal(t.impact,1.8);assert.ok(Math.abs(t.closeEnd-2.82)<1e-12);assert.equal(JSON.stringify(doc),before);
});

test('hero lift and proud reaction continue purposefully across former held poses',()=>{
 assert.ok(openingPose(4.3,timing).heroProgress>openingPose(3.5,timing).heroProgress);
 assert.ok(openingPose(5.8,timing).reactionProgress>openingPose(5.2,timing).reactionProgress);
});

test('source label glitch is a single bounded payoff, not constant shaking',()=>{
 assert.equal(openingPose(6.8,timing).labelGlitch,0);
 assert.notEqual(openingPose(timing.end-.6,timing).labelGlitch,0);
 assert.equal(openingPose(timing.end-.2,timing).labelGlitch,0);
});

test('reaction reach continues through the final spoken line rather than settling early',()=>{
 assert.ok(openingPose(7.8,timing).reactionProgress>openingPose(7.1,timing).reactionProgress+.2);
 assert.ok(openingPose(5.8,timing).reactionProgress<.4);
});
