// Preview only: narrator-only mix and timing are not production or listening approval.
import React from "react";
import {AbsoluteFill,Audio,useCurrentFrame,staticFile} from "remotion";
import {mapNarrationFrame} from "./NarrationFrameMap.mjs";
import {PreviewArticulatedVisual} from "./PreviewArticulatedVisual";

export const Episode1V10NarrationCandidate=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <Audio src={staticFile("audio/episode1-narration.mp3")} volume={1}/>
    <PreviewArticulatedVisual frame={mapNarrationFrame(frame)} finalRuleSize={50}/>
  </AbsoluteFill>;
};
