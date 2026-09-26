import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {Episode1V6VerticalProof} from "./Episode1V6VerticalProof";
import {V8Visual} from "./V8Visual";

export const Episode1V8VerticalProof=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <Episode1V6VerticalProof/>
    <AbsoluteFill style={{background:"#fff"}}><V8Visual frame={frame}/></AbsoluteFill>
  </AbsoluteFill>;
};
