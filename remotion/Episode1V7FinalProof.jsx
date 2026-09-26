import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {Episode1V6VerticalProof} from "./Episode1V6VerticalProof";

export const Episode1V7FinalProof=()=>{
  const frame=useCurrentFrame();
  const scene3=frame>=288 && frame<480;
  return <AbsoluteFill style={{backgroundColor:"#fff"}}>
    <Episode1V6VerticalProof/>
    {scene3 ? <svg width="720" height="1280" style={{position:"absolute",inset:0,pointerEvents:"none"}}>
      <rect x="0" y="570" width="116" height="95" fill="#fff"/>
      <rect x="604" y="570" width="116" height="95" fill="#fff"/>
    </svg> : null}
  </AbsoluteFill>;
};
