import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
import {Environment} from "./EnvironmentSystem";
import {PropIcon} from "./PropSystem";
import {resolveMotion} from "./MotionLibrary";
const C={dave:Dave,points_monk:PointsMonk,cashback_goblin:CashbackGoblin};
const clamp=v=>Math.max(0,Math.min(1,v));
const sceneAt=(scenes,t)=>scenes.find(s=>t>=s.start&&t<s.end)||scenes[scenes.length-1];
const smooth=p=>p*p*(3-2*p);
const camTx=(cam,p)=>{
 const m=cam.move||"static",q=smooth(p);
 if(m==="punch_in"||m==="creeping_push")return `scale(${1+.09*q})`;
 if(m==="snap_reveal"||m==="snap_wide")return `scale(${1.08-.08*q})`;
 if(m==="whip_pan")return `translateX(${(1-q)*70}px)`;
 if(m==="tracking"||m==="guided_track")return `translateX(${(q-.5)*30}px)`;
 if(m==="settle_in")return `scale(${1.035-.035*q})`;
 return `scale(${1+.012*Math.sin(q*Math.PI)})`;
};
const emotionAt=(ch,p)=>{
 const a=ch.performance_engine?.emotion_curve||[]; if(!a.length)return null;
 const dur=a[a.length-1].t||1,t=p*dur; return [...a].reverse().find(x=>t>=x.t)||a[0];
};
export const StudioAnimaticComposition=({ccsd})=>{
 const frame=useCurrentFrame(),fps=24,t=frame/fps,scenes=ccsd?.scenes||[],s=sceneAt(scenes,t);
 if(!s)return <AbsoluteFill style={{background:"#fff"}}/>;
 const local=Math.max(0,frame-Math.round((s.start||0)*fps)),total=Math.max(1,Math.round((s.end-s.start||1)*fps)),p=clamp(local/total);
 const chars=s.characters||[],cam=s.camera||{},story=s.story||{},comp=s.composition||{},focal=comp.focal_point||[.5,.58];
 const baseX=720*focal[0],baseY=1280*focal[1]+95,env=s.environment||{},depth=env.depth_system||{},par=cam.parallax_strength||0;
 const impact=(s.fx||[]).some(x=>x.type==="story_impact"),pulse=Math.sin(local*.34)*4,shake=(impact?Math.sin(local*2.7)*Math.max(0,1-p)*7:0)+pulse;
 return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
  <div style={{position:"absolute",inset:0,transform:`${camTx(cam,p)} translateX(${shake}px)`,transformOrigin:"center"}}>
   <svg width="720" height="1280" viewBox="0 0 720 1280">
    <rect width="720" height="1280" fill="#fff"/>
    {depth.background?<g transform={`translate(${-par*30*p} 0)`} opacity=".55"><Environment id={env.id||"white_stage"} width={720} height={1280} frame={local}/></g>:null}
    <g transform={`translate(${-par*12*p} 0)`}><Environment id={env.id||"white_stage"} width={720} height={1280} frame={local}/></g>
    <text x="360" y="90" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="38" fill="#111">{String(story.beat||"STORY BEAT").slice(0,34)}</text>
    {(s.props||[]).map((prop,i)=>{const b=prop.behavior||{},amp=b.secondary_motion?28:10;const px=360+(i-(s.props.length-1)/2)*145+Math.sin(local*.16+i)*Math.max(amp,22),py=420-Math.sin(local*.11+i)*(b.collision?48:30);return <g key={i} opacity={b.attention_priority?1:.88}><PropIcon id={prop.id} x={px} y={py} s={b.attention_priority?.82:.7} rotation={(1-p)*(i%2?10:-10)}/></g>})}
    {chars.map((ch,i)=>{const id=ch.id||"dave",X=C[id]||Dave,pe=ch.performance_engine||{},me=ch.motion_engine||{},e=emotionAt(ch,p);const intensity=(e?.intensity||.8)*(me.overshoot?1+me.overshoot*Math.sin(p*Math.PI):1);const m=resolveMotion(id,ch.motion_clip||ch.pose||"recoil",p,intensity);const spread=(i-(chars.length-1)/2)*170;const mood=e?.state|| (id==="points_monk"?"deadpan":id==="cashback_goblin"?"smile":"shock");const breath=Math.sin(local/(pe.breath_cycle_frames||72)*Math.PI*2)*4;const microX=Math.sin(local*.13+i)*7;return <g key={id+"-"+i} transform={`translate(0 ${breath})`}><X x={baseX+spread+microX} y={baseY+(m.bob||0)} s={chars.length>1?.95:1.18} lean={m.lean} arm={m.arm} leg={m.leg} mood={mood}/></g>})}
    {(impact||local%48<10)?<g opacity={impact?Math.max(0,1-p):Math.max(0,1-(local%48)/10)} stroke="#111" strokeWidth="4">{Array.from({length:10}).map((_,i)=><line key={i} x1={360+Math.cos(i*.628)*190} y1={640+Math.sin(i*.628)*190} x2={360+Math.cos(i*.628)*270} y2={640+Math.sin(i*.628)*270}/>)}</g>:null}
    {(s.text||{}).content?<text x="360" y="215" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="30" fill="#111">{String(s.text.content).slice(0,42)}</text>:null}
    <text x="360" y="1170" textAnchor="middle" fontFamily="Arial" fontSize="18" fill="#777">{s.id} • {story.intent||"beat"} • {cam.motivation||"camera"}</text>
   </svg>
  </div>
 </AbsoluteFill>
};