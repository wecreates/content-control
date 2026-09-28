import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
const C={dave:Dave,points_monk:PointsMonk,cashback_goblin:CashbackGoblin};
const sceneAt=(scenes,t)=>scenes.find(s=>t>=s.start&&t<s.end)||scenes[scenes.length-1];
export const StudioAnimaticComposition=({ccsd})=>{
 const frame=useCurrentFrame(),t=frame/24,scenes=ccsd?.scenes||[],s=sceneAt(scenes,t);
 if(!s)return <AbsoluteFill style={{background:"#fff"}}/>;
 const chars=s.characters||[],cam=s.camera||{},story=s.story||{};
 return <AbsoluteFill style={{background:"#fff"}}>
  <svg width="720" height="1280" viewBox="0 0 720 1280">
   <rect x="24" y="24" width="672" height="1232" fill="#fff" stroke="#aaa" strokeWidth="3"/>
   <text x="360" y="90" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="38" fill="#111">{String(story.beat||"STORY BEAT").slice(0,34)}</text>
   <text x="360" y="145" textAnchor="middle" fontFamily="Arial" fontSize="22" fill="#666">ANIMATIC • {cam.shot_scale||"medium"} • {cam.move||"static"}</text>
   <rect x="75" y="220" width="570" height="720" rx="22" fill="#f8f8f8" stroke="#111" strokeWidth="4"/>
   {chars.map((ch,i)=>{const X=C[ch.id]||Dave;return <X key={i} x={240+i*250} y={720} s={1.25} mood={ch.id==="points_monk"?"deadpan":ch.id==="cashback_goblin"?"smile":"shock"}/>})}
   {(s.props||[]).map((p,i)=><g key={i} transform={`translate(${360+i*60} 430)`}><rect x="-65" y="-40" width="130" height="80" rx="12" fill="#fff" stroke="#111" strokeWidth="4"/><text x="0" y="8" textAnchor="middle" fontFamily="Arial" fontSize="18" fill="#111">{String(p.id).slice(0,10)}</text></g>)}
   <text x="360" y="1030" textAnchor="middle" fontFamily="Arial" fontSize="22" fill="#555">{s.id}</text>
  </svg>
 </AbsoluteFill>
};