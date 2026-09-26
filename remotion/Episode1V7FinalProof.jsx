import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {Episode1V6VerticalProof} from "./Episode1V6VerticalProof";
import {V7Visual} from "./V7Visual";

export const Episode1V7FinalProof=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{backgroundColor:"#fff"}}>
    <Episode1V6VerticalProof/>
    <AbsoluteFill style={{backgroundColor:"#fff"}}><V7Visual frame={frame}/></AbsoluteFill>
    <div style={{position:"absolute",left:22,top:18,fontFamily:"Arial",fontWeight:1000,fontSize:17,color:"#777",letterSpacing:1}}>CONTENT CONTROL • V7 PARITY</div>
  </AbsoluteFill>;
};
