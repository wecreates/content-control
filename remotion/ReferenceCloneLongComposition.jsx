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
const moodFor=id=>id==="points_monk"?"deadpan":id==="cashback_goblin"?"smile":"shock";
const postureLean=acting=>acting?.posture==="forward_anxious"?4:acting?.posture==="compressed_spring"?-3:0;

export const ReferenceCloneLongComposition=({scenePlan})=>{
  const frame=useCurrentFrame(),fps=24,t=frame/fps,scenes=scenePlan?.scenes||[];
  const s=scenes.find(x=>t>=x.start&&t<x.end)||scenes[scenes.length-1];
  if(!s)return <AbsoluteFill style={{background:"#fff"}}/>;

  const p=clamp((t-s.start)/(s.end-s.start||1));
  const localFrame=Math.max(0,frame-Math.round((s.start||0)*fps));
  const totalFrames=Math.max(1,Math.round((s.end-s.start||1)*fps));
  const ch=s.choreography||{};
  const scale=s.shot_scale==="close"?1.5:s.shot_scale==="wide"?.9:1.15;
  const focal=s.composition?.focal_point||[.5,.56];
  const baseX=1920*focal[0],baseY=1080*focal[1]+40;
  const intensity=Math.max(.5,Math.min(1,(s.motion_intensity||0)*8));
  const fallback=s.camera==="whip_pan"?("translateX("+((1-p)*180)+"px)"):s.camera==="punch_in"?("scale("+(1+.1*p)+")"):("scale("+(1+.025*Math.sin(Math.PI*p))+")");
  const camera=ch.camera_events?.length?choreographyCamera(ch,localFrame):fallback;
  const transition={...transitionStyle(ch.transition_in,localFrame,totalFrames,false),...transitionStyle(ch.transition_out,localFrame,totalFrames,true)};
  const voiceover=scenePlan?.voiceover_path||null;
  const chars=(s.characters?.length?s.characters:[{id:s.character,pose:s.pose,acting:s.acting,face_track:s.facial_performance}]).slice(0,4);

  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <Audio src={staticFile("audio/episode1-music.mp3")} volume={0.035}/>
    {voiceover?<Audio src={staticFile(voiceover)} volume={1}/>:null}
    <div style={{position:"absolute",inset:0,transform:camera,transformOrigin:"center",...transition}}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        <Environment id={s.environment?.id||"white_stage"} width={1920} height={1080} frame={localFrame}/>
        <DepthBackground choreography={ch} localFrame={localFrame} width={1920} height={1080}/>
        {!(ch.text_actions||[]).length?<text x="960" y="90" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="62" fill="#111">REFERENCE-DRIVEN ACT</text>:null}
        <ObjectChoreography choreography={ch} localFrame={localFrame} width={1920} height={1080}/>
        {chars.map((char,i)=>{
          const id=char.id||s.character||"dave",X=C[id]||Dave;
          const motion=resolveMotion(id,char.motion_clip||char.pose||s.pose,p,intensity);
          const contact=performanceTargets(ch,localFrame,id);
          const acting=char.acting||{};
          const spread=(i-(chars.length-1)/2)*270;
          const charScale=scale*(chars.length>2?.74:chars.length>1?.86:1);
          return <X key={id+"-"+i}
            x={baseX+spread}
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
        <ContactCue choreography={ch} localFrame={localFrame} width={1920} height={1080}/>
        <KineticText choreography={ch} localFrame={localFrame} width={1920}/>
        <OverlayChoreography choreography={ch} localFrame={localFrame} width={1920} height={1080}/>
        <MicroGags choreography={ch} localFrame={localFrame} width={1920} height={1080}/>
        {!(ch.text_actions||[]).length?<text x="960" y="1000" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="34" fill="#666">{s.camera} • {s.shot_scale} • act {s.longform?.act||s.index+1}</text>:null}
      </svg>
    </div>
  </AbsoluteFill>;
};
