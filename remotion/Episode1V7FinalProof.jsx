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
      <line x1="115" y1="570" x2="115" y2="635" stroke="#111" strokeWidth="7"/>
      <line x1="605" y1="570" x2="605" y2="635" stroke="#111" strokeWidth="7"/>
      <rect x="130" y="535" width="460" height="60" fill="#fff"/>
      <text x="360" y="575" textAnchor="middle" fill="#111" fontFamily="Arial" fontWeight="900" fontSize="26">ONLY COUNTS IF YOU NEEDED IT.</text>
    </svg> : null}
  </AbsoluteFill>;
};
