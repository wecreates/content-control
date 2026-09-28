import React from "react";
import {AbsoluteFill,Audio,useCurrentFrame,staticFile} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
import {Environment} from "./EnvironmentSystem";
import {resolveMotion} from "./MotionLibrary";
import {
  choreographyCamera,transitionStyle,ObjectChoreography,KineticText,
  OverlayChoreography,DepthBackground,MicroGags,ContactCue,performanceTargets
} from "./ChoreographyRuntime";

const C={dave:Dave,points_monk:PointsMonk,cashback_goblin:CashbackGoblin};
const clamp=v=>Math.max(0,Math.min(1,v));
const sceneFor=(scenes,t)=>scenes.find(s=>t>=s.start&&t<s.end)||scenes[scenes.length-1]||null;
const moodFor=id=>id==="points_monk"?"deadpan":id==="cashback_goblin"?"smile":"shock";
const postureLean=acting=>acting?.posture==="forward_anxious"?4:acting?.posture==="compressed_spring"?-3:0;

const fallbackCamera=(camera,p)=>{
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
  const scale=s.shot_scale==="close"?1.65:s.shot_scale==="wide"?1.05:1.35;
  const intensity=Math.max(.45,Math.min(1,(s.motion_intensity||0)*8*(s.repair_boost?1.35:1)));
  const focal=s.composition?.focal_point||[.5,.58];
  const baseX=720*focal[0],baseY=1280*focal[1]+110;
  const fp=scenePlan?.visual_style_fingerprint||{};
  const rgb=fp.mean_rgb||[1,1,1];
  const light=(fp.mean_luma??1)>.62;
  const bg=light?`rgb(${Math.round(rgb[0]*255)},${Math.round(rgb[1]*255)},${Math.round(rgb[2]*255)})`:"#fff";
  const voiceover=scenePlan?.voiceover_path||null;
  const soundscape=scenePlan?.soundscape_path||null;
  const camera=ch.camera_events?.length?choreographyCamera(ch,localFrame):fallbackCamera(s.camera,p);
  const transition={...transitionStyle(ch.transition_in,localFrame,totalFrames,false),...transitionStyle(ch.transition_out,localFrame,totalFrames,true)};
  const chars=(s.characters?.length?s.characters:[{id:s.character,pose:s.pose,acting:s.acting,face_track:s.facial_performance}]).slice(0,3);

  return <AbsoluteFill style={{background:bg,overflow:"hidden"}}>
    {soundscape?<Audio src={staticFile(soundscape)} volume={0.72}/>:<Audio src={staticFile("audio/episode1-music.mp3")} volume={0.04}/>}
    {voiceover?<Audio src={staticFile(voiceover)} volume={1}/>:null}
    <div style={{position:"absolute",inset:0,transform:camera,transformOrigin:"center",...transition}}>
      <svg width="720" height="1280" viewBox="0 0 720 1280">
        <Environment id={s.environment?.id||"white_stage"} width={720} height={1280} frame={localFrame}/>
        <DepthBackground choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        {!(ch.text_actions||[]).length?<text x="360" y="115" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="48" fill="#111">REFERENCE-DRIVEN BEAT {s.index+1}</text>:null}
        <ObjectChoreography choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        {chars.map((char,i)=>{
          const id=char.id||s.character||"dave",X=C[id]||Dave;
          const motion=resolveMotion(id,char.motion_clip||char.pose||s.pose,p,.5+intensity);
          const contact=performanceTargets(ch,localFrame,id);
          const acting=char.acting||{};
          const spread=(i-(chars.length-1)/2)*150;
          const charScale=scale*(chars.length>1?.78:1);
          return <X key={id+"-"+i}
            x={baseX+spread+Math.sin(p*Math.PI*2+i)*12*intensity}
            y={baseY+(motion.bob||0)}
            s={charScale}
            lean={motion.lean+postureLean(acting)}
            mood={moodFor(id)}
            arm={motion.arm}
            leg={motion.leg}
            armBend={contact.armBend||18}
            legBend={acting.weight_shift==="unstable"?18:12}
            leftHandTarget={contact.leftHandTarget}
            rightHandTarget={contact.rightHandTarget}
          />;
        })}
        <ContactCue choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        <KineticText choreography={ch} localFrame={localFrame} width={720}/>
        <OverlayChoreography choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        <MicroGags choreography={ch} localFrame={localFrame} width={720} height={1280}/>
        {!(ch.text_actions||[]).length?<text x="360" y="1160" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="28" fill="#666">{s.camera} • {s.shot_scale}</text>:null}
      </svg>
    </div>
  </AbsoluteFill>;
};
