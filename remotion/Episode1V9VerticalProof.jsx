import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {Episode1V6VerticalProof} from "./Episode1V6VerticalProof";
import {V9ArticulatedVisual} from "./V9ArticulatedVisual";

export const Episode1V9VerticalProof=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <Episode1V6VerticalProof/>
    <AbsoluteFill style={{background:"#fff"}}><V9ArticulatedVisual frame={frame}/></AbsoluteFill>
  </AbsoluteFill>;
};
