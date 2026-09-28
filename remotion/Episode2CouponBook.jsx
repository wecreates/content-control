import React from "react";
import {AbsoluteFill,Audio,Sequence,useCurrentFrame,staticFile} from "remotion";
import {Episode2CouponBookVisual} from "./Episode2CouponBookVisual";

export const Episode2CouponBook=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <Audio src={staticFile("audio/episode2-narration.mp3")} volume={1}/>
    <Audio src={staticFile("audio/episode1-music.mp3")} volume={0.06}/>
    <Sequence from={4}><Audio src={staticFile("audio/episode1-sfx-1.mp3")} volume={0.62}/></Sequence>
    <Sequence from={180}><Audio src={staticFile("audio/episode1-sfx-2.mp3")} volume={0.52}/></Sequence>
    <Sequence from={420}><Audio src={staticFile("audio/episode1-sfx-1.mp3")} volume={0.54}/></Sequence>
    <Episode2CouponBookVisual frame={frame}/>
  </AbsoluteFill>;
};
