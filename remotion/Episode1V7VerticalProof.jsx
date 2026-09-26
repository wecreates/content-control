import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {V7Visual} from "./V7Visual";

export const Episode1V7VerticalProof=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <V7Visual frame={frame}/>
    <div style={{position:"absolute",left:22,top:18,fontFamily:"Arial",fontWeight:1000,fontSize:17,color:"#777",letterSpacing:1}}>CONTENT CONTROL • V7</div>
  </AbsoluteFill>;
};
