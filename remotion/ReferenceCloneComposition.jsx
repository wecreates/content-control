import React from "react";
import {AbsoluteFill,useCurrentFrame,interpolate} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";

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
  const Ch=C[s.character]||Dave;
  const scale=s.shot_scale==="close"?1.65:s.shot_scale==="wide"?1.05:1.35;
  const x=360+(s.index%2===0?-70:70), y=840;
  const props=["$","%","CARD","FEE"];
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,transform:camTransform(s.camera,p),transformOrigin:"center"}}>
      <svg width="720" height="1280" viewBox="0 0 720 1280">
        <text x="360" y="115" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="48" fill="#111">REFERENCE-DRIVEN BEAT {s.index+1}</text>
        <g transform={`translate(${360+(p-.5)*90} 420) rotate(${(p-.5)*12})`}>
          <rect x="-120" y="-70" width="240" height="140" rx="24" fill="#fff" stroke="#111" strokeWidth="6"/>
          <text x="0" y="14" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="42" fill="#F4C542">{props[s.index%props.length]}</text>
        </g>
        <Ch x={x} y={y} s={scale} mood={s.character==="points_monk"?"deadpan":s.character==="dave"?"shock":"smile"} arm={Math.sin(p*Math.PI)*28} leg={Math.sin(p*Math.PI*2)*12}/>
        <text x="360" y="1160" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="28" fill="#666">{s.camera} • {s.shot_scale}</text>
      </svg>
    </div>
  </AbsoluteFill>
};