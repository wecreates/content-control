import React from "react";
import {AbsoluteFill,Audio,Sequence,useCurrentFrame,staticFile} from "remotion";
import {CashbackCasinoVisual} from "./CashbackCasinoVisual";
export const CashbackCasino=()=>{const frame=useCurrentFrame();return <AbsoluteFill style={{background:"#fff",overflow:"hidden"}}>
<Audio src={staticFile("audio/episode3-cashback.mp3")} volume={1}/>
<Audio src={staticFile("audio/episode1-music.mp3")} volume={0.045}/>
<Sequence from={8}><Audio src={staticFile("audio/episode1-sfx-1.mp3")} volume={0.6}/></Sequence>
<Sequence from={318}><Audio src={staticFile("audio/episode1-sfx-2.mp3")} volume={0.7}/></Sequence>
<Sequence from={420}><Audio src={staticFile("audio/episode1-sfx-1.mp3")} volume={0.45}/></Sequence>
<CashbackCasinoVisual frame={frame}/></AbsoluteFill>};