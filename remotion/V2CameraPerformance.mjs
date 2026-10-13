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
