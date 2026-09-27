import React from "react";
import {AbsoluteFill,Audio,Sequence,useCurrentFrame,staticFile} from "remotion";
import {V9ArticulatedVisual} from "./V9ArticulatedVisual";

export const Episode1V10FinalProof=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <Audio src={staticFile("audio/episode1-narration.mp3")} volume={1}/>
    <Audio src={staticFile("audio/episode1-music.mp3")} volume={0.07}/>
    <Sequence from={3}><Audio src={staticFile("audio/episode1-sfx-1.mp3")} volume={0.72}/></Sequence>
    <Sequence from={150}><Audio src={staticFile("audio/episode1-sfx-2.mp3")} volume={0.58}/></Sequence>
    <Sequence from={288}><Audio src={staticFile("audio/episode1-sfx-1.mp3")} volume={0.60}/></Sequence>
    <V9ArticulatedVisual frame={frame}/>
  </AbsoluteFill>;
};
