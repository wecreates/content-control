import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
import {Environment} from "./EnvironmentSystem";
import {PropIcon} from "./PropSystem";
import {resolveMotion} from "./MotionLibrary";

const C={dave:Dave,points_monk:PointsMonk,cashback_goblin:CashbackGoblin};
const sceneAt=(scenes,t)=>scenes.find(s=>t>=s.start&&t<s.end)||scenes[scenes.length-1];
const clamp=v=>Math.max(0,Math.min(1,v));
const cameraTransform=(move,p)=>{
  if(move==="punch_in")return `scale(${1+.08*p})`;
  if(move==="whip_pan")return `translateX(${(1-p)*70}px)`;
  if(move==="tracking")return `translateX(${(p-.5)*24}px)`;
  if(move==="snap_wide")return `scale(${1.08-.08*p})`;
  return `scale(${1+.015*Math.sin(p*Math.PI)})`;
};

export const StudioAnimaticComposition=({ccsd})=>{
 const frame=useCurrentFrame(),fps=24,t=frame/fps,scenes=ccsd?.scenes||[],s=sceneAt(scenes,t);
 if(!s)return <AbsoluteFill style={{background:"#fff"}}/>;
 const local=Math.max(0,frame-Math.round((s.start||0)*fps));
 const total=Math.max(1,Math.round((s.end-s.start||1)*fps));
 const p=clamp(local/total),chars=s.characters||[],cam=s.camera||{},story=s.story||{},comp=s.composition||{};
 const focal=comp.focal_point||[.5,.58],baseX=720*focal[0],baseY=1280*focal[1]+95;
 const env=(s.environment||{}).id||"white_stage";

 return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
  <div style={{position:"absolute",inset:0,transform:cameraTransform(cam.move||"static",p),transformOrigin:"center"}}>
   <svg width="720" height="1280" viewBox="0 0 720 1280">
    <rect x="24" y="24" width="672" height="1232" fill="#fff" stroke="#aaa" strokeWidth="3"/>
    <Environment id={env} width={720} height={1280} frame={local}/>
    <text x="360" y="90" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="38" fill="#111">{String(story.beat||"STORY BEAT").slice(0,34)}</text>
    <text x="360" y="145" textAnchor="middle" fontFamily="Arial" fontSize="22" fill="#666">ANIMATIC • {cam.shot_scale||"medium"} • {cam.move||"static"}</text>
    {(s.props||[]).map((prop,i)=>{
      const px=360+(i-(s.props.length-1)/2)*145+Math.sin(p*Math.PI*2+i)*24;
      const py=420-Math.sin(p*Math.PI)*34;
      return <PropIcon key={i} id={prop.id} x={px} y={py} s={.72} rotation={(1-p)*(i%2?10:-10)}/>;
    })}
    {chars.map((char,i)=>{
      const id=char.id||"dave",X=C[id]||Dave;
      const m=resolveMotion(id,char.motion_clip||char.pose||"recoil",p,.8);
      const spread=(i-(chars.length-1)/2)*170;
      return <X key={id+"-"+i} x={baseX+spread} y={baseY+(m.bob||0)} s={chars.length>1?.95:1.18}
        lean={m.lean} arm={m.arm} leg={m.leg}
        mood={id==="points_monk"?"deadpan":id==="cashback_goblin"?"smile":"shock"}/>;
    })}
    {(s.text||{}).content?<text x="360" y="215" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="30" fill="#111">{String(s.text.content).slice(0,42)}</text>:null}
    <text x="360" y="1170" textAnchor="middle" fontFamily="Arial" fontSize="20" fill="#777">{s.id} • rough timing</text>
   </svg>
  </div>
 </AbsoluteFill>
};