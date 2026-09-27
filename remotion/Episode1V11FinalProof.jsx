import React from "react";
import {AbsoluteFill,Audio,Sequence,useCurrentFrame} from "remotion";
import {V11ReferenceVisual} from "./V11ReferenceVisual";

export const Episode1V11FinalProof=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:"#f4f0e6",overflow:"hidden"}}>
    <Audio src="https://storage.googleapis.com/adm--audio-playback--7d--public/mcp-preview/86233855-12db-439e-9203-8ac04e2d3281.mp3" volume={1} playbackRate={1.12}/>
    <Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/2f8c3d65-763a-4b65-8f21-2d52c7bc92ed.mp3" volume={0.055}/>
    <Sequence from={4}><Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/9690b9f5-bbd1-4728-b0e0-eea24b8ccceb.mp3" volume={0.55}/></Sequence>
    <Sequence from={116}><Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/9ed40957-df1a-4b57-a1fa-49905557cd0d.mp3" volume={0.48}/></Sequence>
    <Sequence from={290}><Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/9690b9f5-bbd1-4728-b0e0-eea24b8ccceb.mp3" volume={0.45}/></Sequence>
    <Sequence from={458}><Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/9ed40957-df1a-4b57-a1fa-49905557cd0d.mp3" volume={0.42}/></Sequence>
    <V11ReferenceVisual frame={frame}/>
  </AbsoluteFill>;
};
