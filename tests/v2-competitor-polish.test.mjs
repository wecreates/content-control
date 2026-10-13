import test from 'node:test';import assert from 'node:assert/strict';
import {v2ReactionScale} from '../remotion/V2CameraPerformance.mjs';
import {v2InvitationMotion,v2InvitationGrip} from '../remotion/StudioLayout.mjs';
test('fee reaction push is bounded and leaves other beats unchanged',()=>{
 let previous=1;for(let frame=0;frame<=120;frame++){const scale=v2ReactionScale('fee-drain',frame/120);assert.ok(scale>=previous&&scale<=1.14+1e-12);previous=scale;
 // Upper sandwich extent stays beneath the 320px caption reserve, even with existing camera push.
 assert.ok(400+(365-38*.7-400)*scale*1.035>320);
 assert.ok(400+(1145-400)*scale*1.035<1280);
 }assert.equal(v2ReactionScale('fee-drain',0),1);assert.equal(v2ReactionScale('trap',.9),1);
});
test('invitation hand target stays exactly on moving envelope corner',()=>{
 for(let frame=0;frame<=120;frame++){const m=v2InvitationMotion(frame/120),hand=v2InvitationGrip(frame/120);assert.equal(hand.x,m.x-78*m.s);assert.equal(hand.y,m.y+45*m.s);assert.ok(m.x+78*m.s<690);assert.ok(m.x-78*m.s>400);assert.ok(m.y-70*m.s>550);}
 assert.ok(v2InvitationMotion(0).x>v2InvitationMotion(1).x);
});
