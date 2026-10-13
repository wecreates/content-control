// Adjacent editorial cuts with the same beat and camera move share one move.
// Explicit move changes still begin a new camera action; captions are outside it.
import {v2BattleBeat} from './StudioLayout.mjs';
export function v2CameraProgress(scenes,scene,time) {
 const index=scenes.indexOf(scene),beat=v2BattleBeat(scene?.id),move=scene?.camera?.move||'static';
 if(index<0||!beat||!Number.isFinite(time))return 0;
 let first=index,last=index;
 const same=s=>v2BattleBeat(s.id)===beat&&(s.camera?.move||'static')===move;
 while(first>0&&same(scenes[first-1])&&Math.abs(scenes[first-1].end-scenes[first].start)<1e-6)first--;
 while(last+1<scenes.length&&same(scenes[last+1])&&Math.abs(scenes[last].end-scenes[last+1].start)<1e-6)last++;
 return Math.max(0,Math.min(1,(time-scenes[first].start)/Math.max(.001,scenes[last].end-scenes[first].start)));
}

// Repeated editorial metadata must not invent a second physical impact.
export function v2ImpactAmount(scenes,scene,time) {
 const beat=v2BattleBeat(scene?.id);
 if(!beat||!Number.isFinite(time)||!(scene.fx||[]).some(fx=>fx.type==='story_impact'))return 0;
 const first=scenes.find(s=>v2BattleBeat(s.id)===beat);
 if(!first||time<first.start)return 0;
 return Math.max(0,1-(time-first.start)/.3);
}

// Beat-specific actor framing leaves captions, props and environment fixed.
// Feet and held-object contact points remain in world space while faces enlarge.
export function v2FrameActor(beat,slot) {
 // Finish retains its established scale: further enlargement hides the sandwich payoff.
 const multiplier={'amex-counter':1.25,'final-clash':1.25,'trap':1.2}[beat]||1;
 if(multiplier===1)return {...slot};
 const scale=slot.scale*multiplier;
 const framed={...slot,scale,x:slot.x+(beat==='amex-counter'||beat==='final-clash'?(slot.x<360?12:-12):0),y:slot.y+152*(slot.scale-scale)};
 for(const key of ['leftHandTarget','rightHandTarget'])if(slot[key]){
  framed[key]={x:(slot.x+slot[key].x*slot.scale-framed.x)/scale,
               y:(slot.y+slot[key].y*slot.scale-framed.y)/scale};
 }
 return framed;
}

// A restrained reaction push at the fee bite, shared by actors and props.
// The upper sandwich stays below the caption reserve; no rig rescaling or IK drift.
export function v2ReactionScale(beat,progress) {
 if(beat!=='fee-drain'||!Number.isFinite(progress))return 1;
 const p=Math.max(0,Math.min(1,(progress-.35)/.3));
 return 1+.14*p*p*(3-2*p);
}
