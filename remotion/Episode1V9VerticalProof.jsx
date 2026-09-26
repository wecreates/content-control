import React from "react";
import {AbsoluteFill,Audio,Sequence,useCurrentFrame} from "remotion";
import {V9ArticulatedVisual} from "./V9ArticulatedVisual";

const NARRATION="https://cdn.creativeclaw.co/u/49971af6/audio/dc287a1e-a7c4-4784-8305-e6406c5175ed.mp3";
const MUSIC="https://cdn.creativeclaw.co/u/49971af6/audio/2f8c3d65-763a-4b65-8f21-2d52c7bc92ed.mp3";
const PAPER="https://cdn.creativeclaw.co/u/49971af6/audio/9690b9f5-bbd1-4728-b0e0-eea24b8ccceb.mp3";
const WHOOSH="https://cdn.creativeclaw.co/u/49971af6/audio/9ed40957-df1a-4b57-a1fa-49905557cd0d.mp3";

export const Episode1V9VerticalProof=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
    <Audio src={NARRATION} volume={1}/>
    <Audio src={MUSIC} volume={0.07}/>
    <Sequence from={3}><Audio src={PAPER} volume={0.72}/></Sequence>
    <Sequence from={150}><Audio src={WHOOSH} volume={0.58}/></Sequence>
    <Sequence from={288}><Audio src={PAPER} volume={0.60}/></Sequence>
    <V9ArticulatedVisual frame={frame}/>
  </AbsoluteFill>;
};
