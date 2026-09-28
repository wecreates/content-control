import React from "react";
import {AbsoluteFill,Audio,useCurrentFrame,staticFile} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
import {resolveMotion} from "./MotionLibrary";
import {choreographyCamera,transitionStyle,ObjectChoreography,KineticText,OverlayChoreography,DepthBackground,MicroGags,ContactCue} from "./ChoreographyRuntime";

const C={dave:Dave,points_monk:PointsMonk,cashback_goblin:CashbackGoblin};
const clamp=v=>Math.max(0,Math.min(1,v));
const sceneFor=(scenes,t)=>scenes.find(s=>t>=s.start&&t<s.end)||scenes[scenes.length-1]||null;
const camTransform=(camera,p)=>{
  if(camera==="punch_in") return `scale(${1+0.12*p})`;
  if(camera==="whip_pan") return `translateX(${(1-p)*90}px)`;
  if(camera==="impact_close") return `scale(${1.08+0.04*Math.sin(p*Math.PI)})`;
  if(camera==="snap_wide") return `scale(${1.12-0.12*p})`;
  if(camera==="tracking") return `translateX(${(p-.5)*24}px)`;
  return `scale(${1+0.02*Math.sin(p*Math.PI)})`;
};
export const ReferenceCloneComposition=({scenePlan})=>{
  const frame=useCurrentFrame(),fps=24,t=frame/fps,scenes=scenePlan?.scenes||[];
  const s=sceneFor(scenes,t);
  if(!s)return <AbsoluteFill style={{background:"#fff"}}/>;
  const p=clamp((t-s.start)/(s.end-s.start||1));
  const localFrame=Math.max(0,frame-Math.round((s.start||0)*fps));
  const totalFrames=Math.max(1,Math.round((s.end-s.start||1)*fps));
  const ch=s.choreography||{};
  const Ch=C[s.character]||Dave;
  const scale=s.shot_scale==="close"?1.65:s.shot_scale==="wide"?1.05:1.35;
  const intensity=Math.max(0,Math.min(1,(s.motion_intensity||0)*8*(s.repair_boost?1.35:1)));
  const x=360+(s.index%2===0?-70:70), y=840;
  const m=resolveMotion(s.character,s.pose,p,.5+intensity);
  const props=["$","%","CARD","FEE"];
  const fp=scenePlan?.visual_style_fingerprint||{};
  const rgb=fp.mean_rgb||[1,1,1];
  const light=(fp.mean_luma??1)>.62;
  const bg=light?`rgb(${Math.round(rgb[0]*255)},${Math.round(rgb[1]*255)},${Math.round(rgb[2]*255)})`:"#fff";
  const voiceover=scenePlan?.voiceover_path||null;
  const voiceover=scenePlan?.voiceover_path||null;\n  return <AbsoluteFill style={{background:bg,overflow:"hidden"}}><Audio src={staticFile("audio/episode1-music.mp3")} volume={0.04}/>{voiceover?<Audio src={staticFile(voiceover)} volume={1}/>:null}{voiceover?<Audio src={staticFile(voiceover)} volume={1}/>:null}
    <div style={{position:"absolute",inset:0,transform:camTransform(s.camera,p),transformOrigin:"center"}}>
      <svg width="720" height="1280" viewBox="0 0 720 1280">
        <DepthBackground choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        {!(ch.text_actions||[]).length?<text x="360" y="115" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="48" fill="#111">REFERENCE-DRIVEN BEAT {s.index+1}</text>:null}
        <ObjectChoreography choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        <g transform={`translate(${360+(p-.5)*90} 420) rotate(${(p-.5)*12})`}>
          <rect x="-120" y="-70" width="240" height="140" rx="24" fill="#fff" stroke="#111" strokeWidth="6"/>
          <text x="0" y="14" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="42" fill="#F4C542">{props[s.index%props.length]}</text>
        </g>
        <Ch x={x+Math.sin(p*Math.PI*2)*18*intensity} y={y+(m.bob||0)} s={scale} lean={m.lean} mood={s.character==="points_monk"?"deadpan":s.character==="dave"?"shock":"smile"} arm={m.arm} leg={m.leg}/>
        <ContactCue choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        <KineticText choreography={ch} localFrame={localFrame} width={720}/>
        <OverlayChoreography choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        <MicroGags choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        {!(ch.text_actions||[]).length?<text x="360" y="1160" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="28" fill="#666">{s.camera} • {s.shot_scale}</text>:null}
      </svg>
    </div>
  </AbsoluteFill>
};