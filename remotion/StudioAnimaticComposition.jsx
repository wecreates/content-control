import {v2CameraProgress,v2ImpactAmount,v2FrameActor} from './V2CameraPerformance.mjs';
import React from "react";
import {v2FacePerformance} from "./V2FacePerformance.mjs";
import {captionAtTime} from "./ObservedCaptions.mjs";
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
import {Environment} from "./EnvironmentSystem";
import {PropIcon} from "./PropSystem";
import {resolveMotion} from "./MotionLibrary";
import {V2BattleAction,v2WalletMotion} from "./V2BattleAction";
import {fitText,fitCaption,captionTextWidth,normalizePropId,characterSlots,propSlots,v2BattleBeat,v2SceneActor,v2VictoryPose,resolveBattleHandTargets,v2TrapTapHand,v2CapeGrip} from "./StudioLayout.mjs";
const C={dave:Dave,points_monk:PointsMonk,cashback_goblin:CashbackGoblin};
const clamp=v=>Math.max(0,Math.min(1,v));
// Caption motion uses only the currently observed cue; future words never enter the SVG.
const TextBlock=({text,y,height=144,size=34,caption=false,age=1})=>{
 const layout=(caption?fitCaption:fitText)(text,592,height,size);
 const pop=caption?Math.sin(Math.min(1,Math.max(0,age)/.18)*Math.PI):0;
 const punch=/\b(wallet|boss|budget|fee|fees|panic|broke|trap|cost|costs|value|reading|snacks|perks)\b/i.test(text);
 return <g transform={caption?`translate(360 ${y}) scale(${1-pop*.055}) translate(-360 ${-y-pop*5})`:undefined}>
  {layout.lines.map((line,i)=>{
   const baseline=y+i*layout.lineHeight;
   const emphasize=caption&&punch&&i===layout.lines.length-1;
   // A bounded reverse-type panel creates hierarchy without enlarging the safe caption box.
   const width=captionTextWidth(line,layout.size)+16;
   return <g key={i}>
    {emphasize?<rect x={360-width/2} y={baseline-layout.size*.86} width={width} height={layout.size*1.12} rx="8" fill="#111"/>:null}
    <text x="360" y={baseline} textAnchor="middle" fontFamily="Arial Black,Arial,DejaVu Sans,sans-serif" fontWeight="900" fontSize={layout.size} fill={emphasize?'#fff':'#111'} stroke={caption?(emphasize?'#fff':'#111'):'none'} strokeWidth={caption?1.2:0} strokeLinejoin="round" paintOrder="stroke">{line}</text>
   </g>;
  })}
 </g>;
};
export const StudioAnimaticComposition=({ccsd})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),t=frame/fps;
 const s=(ccsd?.scenes||[]).find(scene=>t>=scene.start&&t<scene.end);
 if(!s)return <AbsoluteFill style={{background:"#fff"}}/>;
 const local=Math.max(0,frame-Math.round(s.start*fps)),p=clamp(local/Math.max(1,(s.end-s.start)*fps));
 const chars=s.characters||[],props=s.props||[],slots=characterSlots(chars.length),objects=propSlots(props.length);
 const battle=ccsd?.project_id==='v2-amex-vs-chase-anime-boss-fight' && v2BattleBeat(s.id);
 const impact=(s.fx||[]).some(x=>x.type==="story_impact");
 const impactAmount=battle?v2ImpactAmount(ccsd.scenes,s,t):(impact?Math.max(0,1-local/(fps*.3)):0);
 // Camera action stays inside the action region; observed captions animate independently.
 const cameraP=battle?v2CameraProgress(ccsd.scenes,s,t):p;
 const move=s.camera?.move||'static';
 const scale=move==='punch_in'||move==='creeping_push'?1+.035*cameraP:move==='snap_reveal'?1.035-.035*cameraP:1;
 const pan=(move==='tracking'||move==='guided_track')?(cameraP-.5)*14:0;
 const shake=Math.sin(local*2.7)*impactAmount*3;
 const beatScenes=battle?ccsd.scenes.filter(scene=>v2BattleBeat(scene.id)===battle):[];
 const dialogue=beatScenes.flatMap(scene=>scene.audio?.dialogue||[]).map(line=>line.text).join(' ');
 const observedCaption=battle?captionAtTime(ccsd.caption_track,t):null;
 const title=String(s.story?.beat||'').replace(/^(CONFLICT|ESCALATION|PAYOFF):\s*/i,'');
 return <AbsoluteFill style={{background:'#fff'}}>
  <svg width="100%" height="100%" viewBox="0 0 720 1280">
   <rect width="720" height="1280" fill="#fff"/>
   <TextBlock text={battle?(observedCaption?.text||''):title} y={battle?230:105} height={175} size={battle?72:34} caption={!!battle} age={observedCaption?t-observedCaption.start:1}/>
   {!battle&&s.text?.content?<TextBlock text={s.text.content} y={255} height={78} size={26}/>:null}
   <g transform={`translate(${360+pan+shake} 690) scale(${scale}) translate(-360 -690)`}>
    {!battle?<Environment id={s.environment?.id||'white_stage'} width={720} height={1280} frame={local}/>:null}
    {impactAmount>0?<g opacity={impactAmount*.6} stroke="#111" strokeWidth="3">{[-1,1].map(side=><g key={side}><line x1={360+side*230} y1="635" x2={360+side*265} y2="610"/><line x1={360+side*235} y1="675" x2={360+side*275} y2="675"/></g>)}</g>:null}
    {battle?<V2BattleAction scene={s} scenes={ccsd.scenes} time={t}/>:props.map((prop,i)=>{const slot=objects[i];return <PropIcon key={i} id={normalizePropId(prop.id)} x={slot.x} y={slot.y-Math.sin(p*Math.PI)*14} s={slot.scale} rotation={Math.sin(p*Math.PI)*(i%2?4:-4)}/>;})}
    {chars.map((ch,i)=>{
      const id=ch.id||'dave',Character=C[id];if(!Character)throw new Error(`Unknown character: ${id}`);
      const slot=battle?v2FrameActor(battle,v2SceneActor(battle,id,i,chars.length)):slots[i],curve=ch.performance_engine?.emotion_curve||[];
      const emotion=[...curve].reverse().find(e=>p*(curve.at(-1)?.t||1)>=e.t);
      const defaults={dave:'recoil',points_monk:'deadpan_point',cashback_goblin:'coin_scamper'};
      const m=resolveMotion(id,ch.motion_clip||ch.pose||defaults[id],p,emotion?.intensity??.8,true);
      if(battle){
        if(battle==='amex-counter'&&id==='cashback_goblin'){
          const start=beatScenes[0].start,end=beatScenes.at(-1).end;
          const grip=v2CapeGrip(clamp((t-start)/(end-start)));
          slot.rightHandTarget={x:(grip.x-slot.x)/slot.scale,y:(grip.y-slot.y)/slot.scale};
        }
        if(battle==='trap'){
          const start=beatScenes[0].start,end=beatScenes.at(-1).end;
          const wallet=v2WalletMotion('trap',clamp((t-start)/(end-start))),a=wallet.rotation*Math.PI/180;
          const anchor=x=>({x:(wallet.x+wallet.s*(x*Math.cos(a)-72*Math.sin(a))-slot.x)/slot.scale,y:(wallet.y+wallet.s*(x*Math.sin(a)+72*Math.cos(a))-slot.y)/slot.scale});
          const left=anchor(-102);
          const tap=v2TrapTapHand(clamp((t-start)/(end-start)),{x:slot.x+left.x*slot.scale,y:slot.y+left.y*slot.scale});
          slot.leftHandTarget={x:(tap.x-slot.x)/slot.scale,y:(tap.y-slot.y)/slot.scale};
          slot.rightHandTarget=anchor(102);
        }
        if(battle==='finish'&&id==='dave'){
          const start=beatScenes[0].start,end=beatScenes.at(-1).end;
          Object.assign(m,v2VictoryPose(clamp((t-start)/(end-start))));
        }
        // Keep the deliberate pose/reaction movement, but compensate hand IK so
        // hands stay on the prop instead of drifting with the body rotation.
        Object.assign(m,resolveBattleHandTargets(m,slot,{freeGesture:battle==='finish'&&id==='dave'}));
        m.mood=slot.mood;
      }
      const face=battle?v2FacePerformance({id,beat:battle,time:t,start:beatScenes[0].start,end:beatScenes.at(-1).end,slot,motion:m,observedCaption}):{};
      return <Character {...face} key={i} x={slot.x} y={slot.y+(m.bob||0)} s={slot.scale} lean={m.lean} arm={m.arm} leg={m.leg} leftHandTarget={m.leftHandTarget} rightHandTarget={m.rightHandTarget} mood={m.mood||emotion?.state||(id==='points_monk'?'deadpan':id==='cashback_goblin'?'smile':'shock')} label=""/>;
    })}
   </g>
  </svg>
 </AbsoluteFill>;
};
