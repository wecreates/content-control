import React from "react";
import {AbsoluteFill,Audio,staticFile,useCurrentFrame,interpolate} from "remotion";

const K="#111111", W="#f7f1e6", G="#12a8b4", R="#e53935", Y="#d7a51c";
const C={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const I=(v,a,b,x,y)=>interpolate(v,[a,b],[x,y],C);
const Text=({x=360,y=110,size=46,color=K,children})=>
  <text x={x} y={y} textAnchor="middle" fill={color} fontFamily="Trebuchet MS,DejaVu Sans,sans-serif" fontWeight="900" fontSize={size} letterSpacing="-1.5">{children}</text>;

const Stick=({x=360,y=820,s=1,label="",face="flat",arm=0})=>{
  const mouth=face==="wow"?"M-9 -51 a9 11 0 1 0 18 0 a9 11 0 1 0 -18 0":face==="smile"?"M-15 -58 Q0 -43 15 -58":"M-12 -54 L12 -54";
  return <g transform={`translate(${x} ${y}) scale(${s})`} stroke={K} strokeWidth="5.5" fill="none" strokeLinecap="round">
    <circle cy="-80" r="33" fill={W}/>
    <circle cx="-10" cy="-89" r="3.8" fill={K} stroke="none"/><circle cx="10" cy="-89" r="3.8" fill={K} stroke="none"/>
    <path d={mouth}/><line y1="-46" y2="80"/>
    <line x1="0" y1="-2" x2={-65-arm} y2="40"/><line x1="0" y1="-2" x2={65+arm} y2="40"/>
    <line x1="0" y1="80" x2="-58" y2="160"/><line x1="0" y1="80" x2="58" y2="160"/>
    {label&&<text y="-138" textAnchor="middle" fill={K} stroke="none" fontFamily="Trebuchet MS,DejaVu Sans,sans-serif" fontWeight="900" fontSize="20">{label}</text>}
  </g>
};

const Card=({x,y,rot=0,label="2% CASHBACK"})=><g transform={`translate(${x} ${y}) rotate(${rot})`}>
  <rect x="-125" y="-72" width="250" height="144" rx="20" fill={W} stroke={K} strokeWidth="5.5"/>
  <rect x="-88" y="-35" width="45" height="30" rx="5" fill="#fffaf0" stroke={K} strokeWidth="5"/>
  <Text x={0} y={38} size={25}>{label}</Text>
</g>;

const scenes=[
({p})=><><Text size={54}>2% CASHBACK!</Text><Card x={360} y={450} rot={I(p,0,1,-10,6)}/><Stick x={360} y={900} s={1.25} label="DAVE" face="smile"/><Text y={1170} size={30} color={G}>BRAIN: FREE MONEY DETECTED</Text></>,
({p})=><><Text>Then Dave spends...</Text><Text y={440} size={96}>$80</Text><Stick x={360} y={850} s={1.35} label="DAVE" face="wow" arm={I(p,0,1,0,25)}/><Text y={1120} size={31} color={R}>on stuff he didn’t need</Text></>,
({p})=><><Text>Cashback earned:</Text><Text y={470} size={110} color={G}>$1.60</Text><path d="M180 620 H540" stroke={K} strokeWidth="6"/><Text y={720} size={46}>$80 OUT</Text><Text y={800} size={46} color={G}>$1.60 BACK</Text></>,
({p})=><><Text>Net damage:</Text><Text y={500} size={105} color={R}>$78.40</Text><Stick x={360} y={900} s={1.25} label="DAVE" face="wow"/><Text y={1160} size={30}>Very optimized. Extremely finance.</Text></>,
({p})=><><Text size={54}>THE REAL RULE</Text><Text y={390} size={64}>Cashback ≠ savings</Text><Text y={505} size={46} color={G}>unless you’d buy it anyway</Text><Stick x={360} y={900} s={1.3} label="POINTS MONK" face="flat"/></>,
({p})=><><Text size={56}>DON’T SPEND $80</Text><Text y={270} size={45}>to “earn”</Text><Text y={420} size={100} color={G}>$1.60</Text><path d={`M${I(p,0,1,150,225)} 570 L${I(p,0,1,570,495)} 760`} stroke={R} strokeWidth="18" strokeLinecap="round"/><Card x={360} y={670} rot={I(p,0,1,-5,8)}/><Text y={1150} size={34}>Ignore the flex. Keep the math.</Text></>
];

const cuts=[0,3,6,9,12,15,18];

export const CashbackTrapSnippet=()=>{
  const frame=useCurrentFrame();
  const t=frame/24;
  let n=cuts.length-2;
  for(let i=0;i<cuts.length-1;i++) if(t>=cuts[i]&&t<cuts[i+1]){n=i;break;}
  const start=cuts[n],end=cuts[n+1],p=Math.max(0,Math.min(1,(t-start)/(end-start)));
  const Scene=scenes[n];
  const zoom=1+0.025*Math.sin(Math.PI*p);
  const jitterX=Math.sin(frame*0.33+n)*1.0;
  const jitterY=Math.cos(frame*0.29+n)*0.7;
  return <AbsoluteFill style={{background:W,overflow:"hidden"}}>
    <Audio src={staticFile("audio/cashback-trap-voice.mp3")} volume={1}/>
    <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 20% 15%,rgba(0,0,0,.025) 0 1px,transparent 1.4px),radial-gradient(circle at 80% 70%,rgba(0,0,0,.018) 0 1px,transparent 1.4px)",backgroundSize:"18px 18px,23px 23px"}}/>
    <svg width="720" height="1280" viewBox="0 0 720 1280" style={{position:"absolute",inset:0,transform:`translate(${jitterX}px,${jitterY}px) scale(${zoom})`,transformOrigin:"center"}}>
      <Scene p={p}/>
    </svg>
  </AbsoluteFill>;
};
