import React from "react";
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
import {Environment} from "./EnvironmentSystem";
import {PropIcon} from "./PropSystem";
import {resolveMotion} from "./MotionLibrary";
import {fitText,normalizePropId,characterSlots,propSlots} from "./StudioLayout.mjs";
const C={dave:Dave,points_monk:PointsMonk,cashback_goblin:CashbackGoblin};
const clamp=v=>Math.max(0,Math.min(1,v));
const TextBlock=({text,y,height=144,size=34})=>{
 const layout=fitText(text,592,height,size);
 return <text x="360" y={y} textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="700" fontSize={layout.size} fill="#111">{layout.lines.map((line,i)=><tspan key={i} x="360" dy={i?layout.lineHeight:0}>{line}</tspan>)}</text>;
};
export const StudioAnimaticComposition=({ccsd})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),t=frame/fps;
 const s=(ccsd?.scenes||[]).find(scene=>t>=scene.start&&t<scene.end);
 if(!s)return <AbsoluteFill style={{background:"#fff"}}/>;
 const local=Math.max(0,frame-Math.round(s.start*fps)),p=clamp(local/Math.max(1,(s.end-s.start)*fps));
 const chars=s.characters||[],props=s.props||[],slots=characterSlots(chars.length),objects=propSlots(props.length);
 const impact=(s.fx||[]).some(x=>x.type==="story_impact");
 const impactAmount=impact?Math.max(0,1-local/(fps*.3)):0;
 // Camera action stays inside the action region; typography never shakes or zooms.
 const move=s.camera?.move||'static';
 const scale=move==='punch_in'||move==='creeping_push'?1+.035*p:move==='snap_reveal'?1.035-.035*p:1;
 const pan=(move==='tracking'||move==='guided_track')?(p-.5)*14:0;
 const shake=Math.sin(local*2.7)*impactAmount*3;
 const title=String(s.story?.beat||'').replace(/^(CONFLICT|ESCALATION|PAYOFF):\s*/i,'');
 return <AbsoluteFill style={{background:'#fff'}}>
  <svg width="100%" height="100%" viewBox="0 0 720 1280">
   <rect width="720" height="1280" fill="#fff"/>
   <TextBlock text={title} y={105}/>
   {s.text?.content?<TextBlock text={s.text.content} y={255} height={78} size={26}/>:null}
   <g transform={`translate(${360+pan+shake} 690) scale(${scale}) translate(-360 -690)`}>
    <Environment id={s.environment?.id||'white_stage'} width={720} height={1280} frame={local}/>
    {impactAmount>0?<g opacity={impactAmount*.6} stroke="#111" strokeWidth="3">{[-1,1].map(side=><g key={side}><line x1={360+side*230} y1="635" x2={360+side*265} y2="610"/><line x1={360+side*235} y1="675" x2={360+side*275} y2="675"/></g>)}</g>:null}
    {props.map((prop,i)=>{const slot=objects[i];return <PropIcon key={i} id={normalizePropId(prop.id)} x={slot.x} y={slot.y-Math.sin(p*Math.PI)*14} s={slot.scale} rotation={Math.sin(p*Math.PI)*(i%2?4:-4)}/>;})}
    {chars.map((ch,i)=>{
      const id=ch.id||'dave',Character=C[id];if(!Character)throw new Error(`Unknown character: ${id}`);
      const slot=slots[i],curve=ch.performance_engine?.emotion_curve||[];
      const emotion=[...curve].reverse().find(e=>p*(curve.at(-1)?.t||1)>=e.t);
      const defaults={dave:'recoil',points_monk:'deadpan_point',cashback_goblin:'coin_scamper'};
      const m=resolveMotion(id,ch.motion_clip||ch.pose||defaults[id],p,emotion?.intensity??.8,true);
      return <Character key={i} x={slot.x} y={slot.y+(m.bob||0)} s={slot.scale} lean={m.lean} arm={m.arm} leg={m.leg} mood={emotion?.state||(id==='points_monk'?'deadpan':id==='cashback_goblin'?'smile':'shock')} label=""/>;
    })}
   </g>
  </svg>
 </AbsoluteFill>;
};
