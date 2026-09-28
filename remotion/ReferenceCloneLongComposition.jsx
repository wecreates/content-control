import React from "react";
import {AbsoluteFill,Audio,useCurrentFrame,staticFile} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
const C={dave:Dave,points_monk:PointsMonk,cashback_goblin:CashbackGoblin};
const clamp=v=>Math.max(0,Math.min(1,v));
export const ReferenceCloneLongComposition=({scenePlan})=>{
 const frame=useCurrentFrame(),t=frame/24,scenes=scenePlan?.scenes||[];
 const s=scenes.find(x=>t>=x.start&&t<x.end)||scenes[scenes.length-1];
 if(!s)return <AbsoluteFill style={{background:"#fff"}}/>;
 const p=clamp((t-s.start)/(s.end-s.start||1)),Ch=C[s.character]||Dave;
 const wide=s.shot_scale==="wide",close=s.shot_scale==="close";
 const scale=close?1.5:wide?.9:1.15;
 const x=960+(s.index%2===0?-260:260),y=610;
 const camera=s.camera==="whip_pan"?("translateX("+((1-p)*180)+"px)"):s.camera==="punch_in"?("scale("+(1+.1*p)+")"):("scale("+(1+.025*Math.sin(Math.PI*p))+")");
 const voiceover=scenePlan?.voiceover_path||null;\n return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}><Audio src={staticFile("audio/episode1-music.mp3")} volume={0.035}/>{voiceover?<Audio src={staticFile(voiceover)} volume={1}/>:null}
 <div style={{position:"absolute",inset:0,transform:camera,transformOrigin:"center"}}>
 <svg width="1920" height="1080" viewBox="0 0 1920 1080">
  <text x="960" y="90" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="62" fill="#111">REFERENCE-DRIVEN ACT</text>
  <rect x="720" y="245" width="480" height="240" rx="34" fill="#fff" stroke="#111" strokeWidth="8"/>
  <text x="960" y="385" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="72" fill="#F4C542">{["$","%","FEE","POINTS"][s.index%4]}</text>
  <Ch x={x} y={y} s={scale} mood={s.character==="points_monk"?"deadpan":s.character==="dave"?"shock":"smile"} arm={Math.sin(p*Math.PI)*28} leg={Math.sin(p*Math.PI*2)*12}/>
  <text x="960" y="1000" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="34" fill="#666">{s.camera} • {s.shot_scale} • act {s.index+1}</text>
 </svg></div></AbsoluteFill>;
};