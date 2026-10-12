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
