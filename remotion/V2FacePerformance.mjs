// Deterministic facial performance, driven by absolute time rather than cut time.
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function v2FacePerformance({id,beat,time,start,end,slot,motion={}}) {
 const p=clamp((time-start)/Math.max(.001,end-start),0,1),q=p*p*(3-2*p);
 const target={
  'cold-open':{x:360,y:510},'chase-strike':{x:435,y:480},
  'amex-counter':{x:470,y:492-q*32},'fee-drain':{x:540-180*q,y:500},
  'points-summon':{x:488,y:468},'trap':{x:360,y:532},
  'final-clash':{x:360,y:450},'finish':{x:360,y:462},
 }[beat];
 if(!target) return {};
 // Convert the action focus into the tilted character's local face coordinates.
 const dx=(target.x-slot.x)/slot.scale,dy=(target.y-slot.y-(motion.bob||0))/slot.scale;
 const angle=-(motion.lean||0)*Math.PI/180;
 const localX=dx*Math.cos(angle)-dy*Math.sin(angle);
 const localY=dx*Math.sin(angle)+dy*Math.cos(angle)+(id==='cashback_goblin'?55:88);
 const phase={dave:0,points_monk:1.1,cashback_goblin:2.2}[id]??0;
 const cycle=((time+phase)%3.7+3.7)%3.7;
 const blink=time-start<.35?1:1-Math.max(0,1-Math.abs(cycle-2.8)/.09);
 const alarm=slot.mood==='panic'||slot.mood==='shock';
 return {gazeX:clamp(localX/70,-3,3),gazeY:clamp(localY/70,-2,2),blink,browLift:alarm?3+2*Math.sin(p*Math.PI):0};
}
