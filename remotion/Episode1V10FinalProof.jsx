import React from "react";
import {AbsoluteFill,Audio,useCurrentFrame,staticFile} from "remotion";
import {mapNarrationFrame} from "./NarrationFrameMap.mjs";
import {V9ArticulatedVisual} from "./V9ArticulatedVisual";

export const Episode1V10FinalProof=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <Audio src={staticFile("audio/episode1-narration.mp3")} volume={1}/>
    <V9ArticulatedVisual frame={mapNarrationFrame(frame)} finalRuleSize={50}/>
  </AbsoluteFill>;
};
