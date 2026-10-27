const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
export const openingTiming=ccsd=>{
 const cues=ccsd?.caption_track?.cues||[];
 const dent=cues.find(c=>c.scene_id==='scene-000'&&/dented/i.test(c.word||''));
 const table=cues.find(c=>c.scene_id==='scene-000'&&/table/i.test(c.word||''));
 const line=ccsd.scenes.find(s=>s.id==='scene-003');
 const end=ccsd.scenes.find(s=>s.id==='scene-005')?.start??7.958333333333333;
 return {impact:dent?.start??1.66,closeEnd:(table?.end??2.5)+.12,heroEnd:(line?.start??5.375)-.35,end};
};
export const openingPose=(time,timing)=>{
 const impact=timing.impact,hit=time-impact;
 const anticipation=ease(time/Math.max(.01,impact-.28));
 const drop=clamp((time-(impact-.28))/.28);
 const dent=hit<0?0:18*(1-Math.exp(-hit*32));
 const bounce=hit>0?12*Math.exp(-hit*12)*Math.sin(hit*28):0;
 const y=hit<0?320-28*anticipation+144*drop*drop:436+dent-bounce;
 return {shot:time<timing.closeEnd?'impact-closeup':time<timing.heroEnd?'hero-low-angle':'reaction-medium',
  cardY:y,cardAngle:hit<0?-12*(1-drop):3*Math.exp(-hit*10)*Math.sin(hit*22),
  dent,shake:hit>=0&&hit<.35?4*Math.exp(-hit*10)*Math.sin(hit*85):0,
  impactOpacity:hit>=0?Math.max(0,1-hit/.28):0,
  labelGlitch:time>=timing.end-.75&&time<timing.end-.35?9*Math.sin((time-(timing.end-.75))*65):0,
  heroProgress:clamp((time-timing.closeEnd)/Math.max(.1,timing.heroEnd-timing.closeEnd)),reactionProgress:clamp((time-timing.heroEnd)/Math.max(.1,timing.end-timing.heroEnd))};
};

