import React from "react";
import {AbsoluteFill,useCurrentFrame} from "remotion";
import {Episode1V6VerticalProof} from "./Episode1V6VerticalProof";
import {V10StoryVisual} from "./V10StoryVisual";
export const Episode1V10VerticalProof=()=>{const frame=useCurrentFrame();return <AbsoluteFill style={{background:"#fffdf7",overflow:"hidden"}}><Episode1V6VerticalProof/><AbsoluteFill><V10StoryVisual frame={frame}/></AbsoluteFill></AbsoluteFill>;};
