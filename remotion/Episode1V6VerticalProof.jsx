import React from "react";
import {AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame} from "remotion";

const clamp={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const i=(v,a,b,c,d)=>interpolate(v,[a,b],[c,d],clamp);
const BLACK="#111111", WHITE="#ffffff", RED="#e53935", GREEN="#16a34a", GOLD="#b7791f", GRAY="#666";

const Stick=({x,y,s=1,pose=0,label,face="flat"})=>{
  const arm=Math.sin(pose)*24, leg=Math.sin(pose*.8)*18;
  const mouth=face==="mad"?"M-16 -60 Q0 -72 16 -60":face==="smile"?"M-16 -66 Q0 -50 16 -66":"M-12 -58 L12 -58";
  return <g transform={`translate(${x} ${y}) scale(${s})`} stroke={BLACK} strokeWidth="7" fill="none" strokeLinecap="round">
    <circle cx="0" cy="-82" r="34" fill={WHITE}/>
    <circle cx="-11" cy="-90" r="4" fill={BLACK} stroke="none"/><circle cx="11" cy="-90" r="4" fill={BLACK} stroke="none"/>
    <path d={mouth}/>
    <line x1="0" y1="-48" x2="0" y2="88"/>
    <line x1="0" y1="-4" x2={-70-arm} y2={35+arm*.25}/><line x1="0" y1="-4" x2={70+arm} y2={-4-arm*.25}/>
    <line x1="0" y1="88" x2={-52-leg} y2="178"/><line x1="0" y1="88" x2={52+leg} y2="178"/>
    <text x="0" y="-135" textAnchor="middle" fill={BLACK} stroke="none" fontFamily="Arial" fontWeight="900" fontSize="26">{label}</text>
  </g>;
};

const Card=({x,y,tilt=0})=><g transform={`translate(${x} ${y}) rotate(${tilt})`}>
  <rect x="-125" y="-78" width="250" height="156" rx="20" fill={WHITE} stroke={BLACK} strokeWidth="7"/>
  <rect x="-95" y="-44" width="52" height="34" rx="5" fill="#ddd" stroke={BLACK} strokeWidth="5"/>
  <text x="0" y="42" textAnchor="middle" fill={BLACK} fontFamily="Arial" fontWeight="900" fontSize="25">$695 / YEAR</text>
</g>;

const Bubble=({x,y,w=560,children})=><g transform={`translate(${x} ${y})`}>
  <rect x={-w/2} y="-78" width={w} height="156" rx="28" fill={WHITE} stroke={BLACK} strokeWidth="6"/>
  <path d="M-70 78 L-35 118 L15 78" fill={WHITE} stroke={BLACK} strokeWidth="6"/>
  <foreignObject x={-w/2+26} y="-58" width={w-52} height="116">
    <div xmlns="http://www.w3.org/1999/xhtml" style={{fontFamily:"Arial,Helvetica,sans-serif",fontWeight:900,fontSize:30,lineHeight:1.05,textAlign:"center",color:BLACK,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{children}</div>
  </foreignObject>
</g>;

const Headline=({children,color=BLACK})=><div style={{position:"absolute",left:44,right:44,top:54,textAlign:"center",fontFamily:"Arial,Helvetica,sans-serif",fontWeight:1000,fontSize:58,lineHeight:.95,color,letterSpacing:-2}}>{children}</div>;
const Bottom=({children})=><div style={{position:"absolute",left:50,right:50,bottom:82,textAlign:"center",fontFamily:"Arial,Helvetica,sans-serif",fontWeight:900,fontSize:34,lineHeight:1.03,color:BLACK}}>{children}</div>;

const Scene1=({t})=><AbsoluteFill style={{backgroundColor:WHITE}}>
  <Headline>THE CARD CAME BACK.</Headline>
  <svg width="720" height="1280" style={{position:"absolute",inset:0}}>
    <Stick x={210} y={760} s={1.35} pose={t*3} label="DAVE" face="mad"/>
    <Card x={515} y={620} tilt={i(t,0,1.2,-18,7)}/>
    <Bubble x={360} y={280}>I JUST PAID $695 FOR THIS CARD. AGAIN.</Bubble>
    <line x1="60" y1="1020" x2="660" y2="1020" stroke={BLACK} strokeWidth="6"/>
  </svg>
  <Bottom>ANNUAL FEE: $695</Bottom>
</AbsoluteFill>;

const Scene2=({t})=><AbsoluteFill style={{backgroundColor:WHITE}}>
  <Headline color={RED}>CHAD HAS A “SOLUTION.”</Headline>
  <svg width="720" height="1280" style={{position:"absolute",inset:0}}>
    <Stick x={515} y={760} s={1.35} pose={t*4} label="CHAD" face="smile"/>
    <g transform="translate(165 650)">
      <rect x="-115" y="-90" width="230" height="180" rx="16" fill={WHITE} stroke={BLACK} strokeWidth="7"/>
      <text x="0" y="-15" textAnchor="middle" fill={BLACK} fontFamily="Arial" fontWeight="900" fontSize="28">BUY $80</text>
      <text x="0" y="35" textAnchor="middle" fill={GREEN} fontFamily="Arial" fontWeight="1000" fontSize="38">SAVE $20</text>
    </g>
    <Bubble x={360} y={280}>RELAX. SPEND $80 TO USE THE $20 CREDIT.</Bubble>
  </svg>
  <Bottom>THIS IS WHY CHAD OWNS 14 “DEALS.”</Bottom>
</AbsoluteFill>;

const Scene3=({t})=><AbsoluteFill style={{backgroundColor:WHITE}}>
  <Headline>POINTS MONK DOES THE MATH.</Headline>
  <svg width="720" height="1280" style={{position:"absolute",inset:0}}>
    <Stick x={150} y={790} s={1.18} pose={.4} label="DAVE"/>
    <Stick x={570} y={790} s={1.18} pose={-1.1} label="POINTS MONK" face="mad"/>
    <g transform={`translate(360 ${535+i(t,0,.6,-160,0)})`}>
      <rect x="-245" y="-100" width="490" height="200" rx="22" fill={WHITE} stroke={BLACK} strokeWidth="7"/>
      <text x="0" y="-30" textAnchor="middle" fill={RED} fontFamily="Arial" fontWeight="1000" fontSize="48">$80 − $20 = $60</text>
      <text x="0" y="38" textAnchor="middle" fill={BLACK} fontFamily="Arial" fontWeight="900" fontSize="28">YOU PAID EXTRA TO “SAVE.”</text>
    </g>
  </svg>
  <Bottom>THAT IS NOT SAVING.</Bottom>
</AbsoluteFill>;

const Scene4=({t})=> {
  const bar=Math.max(0,Math.min(1,t/7));
  return <AbsoluteFill style={{backgroundColor:WHITE}}>
    <Headline color={GOLD}>THE ONLY RULE THAT MATTERS</Headline>
    <svg width="720" height="1280" style={{position:"absolute",inset:0}}>
      <Stick x={360} y={840} s={1.3} pose={t*2} label="POINTS MONK" face="flat"/>
      <rect x="85" y="330" width="550" height="70" rx="35" fill="#eee" stroke={BLACK} strokeWidth="6"/>
      <rect x="85" y="330" width={550*bar} height="70" rx="35" fill={bar>.65?GREEN:"#f4c542"} stroke="none"/>
      <text x="360" y="290" textAnchor="middle" fill={BLACK} fontFamily="Arial" fontWeight="1000" fontSize="38">VALUE YOU'D BUY ANYWAY</text>
      <text x="360" y="475" textAnchor="middle" fill={BLACK} fontFamily="Arial" fontWeight="1000" fontSize="34">vs. FEE YOU ACTUALLY PAY</text>
      <text x="360" y="555" textAnchor="middle" fill={bar>.65?GREEN:RED} fontFamily="Arial" fontWeight="1000" fontSize="48">{bar>.65?"KEEP IT":"DO THE MATH"}</text>
    </svg>
    <Bottom>IF THE MATH LOSES, CANCEL THE CARD.</Bottom>
  </AbsoluteFill>;
};

export const Episode1V6VerticalProof=()=>{
  const frame=useCurrentFrame(), t=frame/24;
  const s=t<6?1:t<12?2:t<20?3:4;
  const local=s===1?t:s===2?t-6:s===3?t-12:t-20;
  return <AbsoluteFill style={{backgroundColor:WHITE,overflow:"hidden"}}>
    <Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/dc287a1e-a7c4-4784-8305-e6406c5175ed.mp3" volume={1}/>
    <Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/2f8c3d65-763a-4b65-8f21-2d52c7bc92ed.mp3" volume={0.07}/>
    <Sequence from={12}><Audio src="https://storage.googleapis.com/adm--audio-playback--7d--public/mcp-preview/490e962a-a584-4652-9fe7-39b4c5df2028.mp3" volume={1}/></Sequence>
    <Sequence from={152}><Audio src="https://storage.googleapis.com/adm--audio-playback--7d--public/mcp-preview/d0ffce1f-92ee-4edf-b061-a11623b1dfb2.mp3" volume={1}/></Sequence>
    <Sequence from={292}><Audio src="https://storage.googleapis.com/adm--audio-playback--7d--public/mcp-preview/00bef0f9-0e36-4c48-9a09-d6c98c9fac47.mp3" volume={1}/></Sequence>
    <Sequence from={3}><Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/9690b9f5-bbd1-4728-b0e0-eea24b8ccceb.mp3" volume={0.72}/></Sequence>
    <Sequence from={150}><Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/9ed40957-df1a-4b57-a1fa-49905557cd0d.mp3" volume={0.58}/></Sequence>
    <Sequence from={288}><Audio src="https://cdn.creativeclaw.co/u/49971af6/audio/9690b9f5-bbd1-4728-b0e0-eea24b8ccceb.mp3" volume={0.60}/></Sequence>
    {s===1?<Scene1 t={local}/>:s===2?<Scene2 t={local}/>:s===3?<Scene3 t={local}/>:<Scene4 t={local}/>}
    <div style={{position:"absolute",left:24,top:20,fontFamily:"Arial",fontWeight:1000,fontSize:18,color:GRAY,letterSpacing:1}}>CONTENT CONTROL</div>
  </AbsoluteFill>;
};
