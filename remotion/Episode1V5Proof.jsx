import React from "react";
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

const C={bg:"#0b1018",ink:"#f6f7fb",green:"#41ff66",red:"#ff4c5d",yellow:"#ffd84d",blue:"#58a6ff",muted:"#7e889b"};
const clamp={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const lerp=(v,a,b,c,d)=>interpolate(v,[a,b],[c,d],clamp);
const vis=(t,a,b)=>interpolate(t,[a,a+.12,b-.12,b],[0,1,1,0],clamp);
const bounce=(frame,fps,start)=>spring({frame:frame-start*fps,fps,config:{damping:10,stiffness:180,mass:.7}});

const Stick=({x,y,s=1,pose=0,face="neutral",color=C.ink,opacity=1})=>{
  const arm=Math.sin(pose)*25, leg=Math.sin(pose*.75)*18;
  const mouth=face==="panic"?"M-15 -52 Q0 -70 15 -52":face==="smile"?"M-15 -62 Q0 -45 15 -62":face==="annoyed"?"M-13 -51 Q0 -45 13 -51":"M-10 -57 L10 -57";
  return <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity} stroke={color} strokeWidth="7" fill="none" strokeLinecap="round">
    <circle cx="0" cy="-75" r="30"/>
    <line x1="0" y1="-45" x2="0" y2="78"/>
    <line x1="0" y1="-8" x2={-64-arm} y2={28+arm*.28}/><line x1="0" y1="-8" x2={64+arm} y2={-4-arm*.22}/>
    <line x1="0" y1="78" x2={-48-leg} y2="160"/><line x1="0" y1="78" x2={48+leg} y2="160"/>
    <circle cx="-10" cy="-82" r="3.5" fill={color} stroke="none"/><circle cx="10" cy="-82" r="3.5" fill={color} stroke="none"/>
    <path d={mouth}/>
  </g>;
};

const PersonifiedCard=({x,y,s=1,face="smile",tilt=0})=><g transform={`translate(${x} ${y}) scale(${s}) rotate(${tilt})`}>
  <rect x="-130" y="-78" width="260" height="156" rx="24" fill="#20293a" stroke={C.ink} strokeWidth="7"/>
  <rect x="-105" y="-48" width="54" height="35" rx="6" fill={C.yellow}/>
  <circle cx="-40" cy="8" r="7" fill={C.ink}/><circle cx="40" cy="8" r="7" fill={C.ink}/>
  <path d={face==="smile"?"M-42 36 Q0 68 42 36":"M-42 55 Q0 30 42 55"} fill="none" stroke={C.ink} strokeWidth="6"/>
  <line x1="-128" y1="40" x2="-185" y2="95" stroke={C.ink} strokeWidth="7"/><line x1="128" y1="40" x2="185" y2="95" stroke={C.ink} strokeWidth="7"/>
  <line x1="-70" y1="77" x2="-100" y2="145" stroke={C.ink} strokeWidth="7"/><line x1="70" y1="77" x2="100" y2="145" stroke={C.ink} strokeWidth="7"/>
</g>;

const Caption=({text,t,a,b,color=C.ink,size=38,y=620})=><div style={{
  position:"absolute",left:70,right:70,top:y-50,textAlign:"center",opacity:vis(t,a,b),
  fontFamily:"Arial,Helvetica,sans-serif",fontWeight:1000,fontSize:size,lineHeight:1.02,color,
  textShadow:"0 6px 20px #000",letterSpacing:.2
}}>{text}</div>;

const StoreBg=()=> <svg width="1280" height="720" style={{position:"absolute",inset:0,zIndex:0}}>
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#172030"/><stop offset="1" stopColor="#0b1018"/></linearGradient></defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <rect x="0" y="500" width="1280" height="220" fill="#101723"/>
  <rect x="60" y="95" width="280" height="175" rx="20" fill="#141c29" stroke="#26344a" strokeWidth="5"/>
  <rect x="940" y="80" width="250" height="190" rx="18" fill="#141c29" stroke="#26344a" strokeWidth="5"/>
  <line x1="0" y1="500" x2="1280" y2="500" stroke="#2a3950" strokeWidth="5"/>
</svg>;

const ShotPaid=({t,frame,fps})=>{
  const local=t;
  const receipt=lerp(local,1.4,2.3,-220,400);
  const shake=local>2.25&&local<2.65?Math.sin(local*70)*12:0;
  return <AbsoluteFill style={{transform:`translateX(${shake}px)`}}>
    <StoreBg/>
    <svg width="1280" height="720" style={{position:"absolute",inset:0,zIndex:1}}>
      <Stick x={400} y={430} s={1.55} pose={local*2} face={local<2.2?"smile":"panic"}/>
      <g transform="translate(890 310)">
        <rect x="-160" y="-260" width="320" height="520" rx="34" fill="#101722" stroke={C.green} strokeWidth="8"/>
        <text x="0" y="-120" textAnchor="middle" fill={C.muted} fontSize="26" fontWeight="900">CARD BALANCE</text>
        <text x="0" y="-35" textAnchor="middle" fill={C.green} fontSize="70" fontWeight="1000">$0.00</text>
        <text x="0" y="55" textAnchor="middle" fill={C.ink} fontSize="28" fontWeight="900">PAID IN FULL</text>
      </g>
      <g transform={`translate(640 ${receipt}) rotate(-8)`}>
        <rect x="-220" y="-72" width="440" height="144" rx="16" fill="#f3efe6" stroke={C.red} strokeWidth="8"/>
        <text x="0" y="-5" textAnchor="middle" fill="#161616" fontSize="51" fontWeight="1000">$200 ANNUAL FEE</text>
        <text x="0" y="41" textAnchor="middle" fill="#444" fontSize="22" fontWeight="900">WELCOME BACK</text>
      </g>
    </svg>
    <Caption text="Alex just paid his credit card bill. Great." t={local} a={0} b={2.0} size={35}/>
  </AbsoluteFill>;
};

const ShotBetrayal=({t})=>{
  const local=t-3;
  const cardIn=lerp(local,0,.45,1450,875);
  return <AbsoluteFill>
    <StoreBg/>
    <svg width="1280" height="720" style={{position:"absolute",inset:0,zIndex:1}}>
      <Stick x={340} y={430} s={1.55} pose={-1.2+local*.8} face="annoyed"/>
      <PersonifiedCard x={cardIn} y={345} s={1.15} face="smile" tilt={-5+Math.sin(local*5)*2}/>
      <line x1="590" y1="485" x2="690" y2="485" stroke="#34435c" strokeWidth="6"/>
      <text x="340" y="155" textAnchor="middle" fill={C.red} fontSize="27" fontWeight="1000">ALEX</text>
      <text x="875" y="160" textAnchor="middle" fill={C.green} fontSize="27" fontWeight="1000">PREMIUM CARD</text>
      <g opacity={vis(local,1.2,4)}>
        <path d="M770 170 Q870 80 1000 170" fill="none" stroke={C.ink} strokeWidth="5"/>
        <text x="886" y="110" textAnchor="middle" fill={C.ink} fontSize="29" fontWeight="1000">$200, PLEASE.</text>
      </g>
    </svg>
    <Caption text="Then his premium card sends him a $200 annual fee." t={local} a={0} b={3.7} color={C.red} size={34}/>
  </AbsoluteFill>;
};

const ShotReaction=({t})=>{
  const local=t-7;
  const zoom=1+lerp(local,0,2,0,.17);
  return <AbsoluteFill style={{backgroundColor:C.bg}}>
    <div style={{position:"absolute",inset:0,transform:`scale(${zoom})`,transformOrigin:"30% 55%"}}>
      <StoreBg/>
      <svg width="1280" height="720" style={{position:"absolute",inset:0,zIndex:1}}>
        <Stick x={390} y={430} s={2.1} pose={Math.sin(local*4)*.4} face="annoyed"/>
        <g opacity={vis(local,.7,3.7)} transform="translate(820 250)">
          <text x="0" y="0" textAnchor="middle" fill={C.yellow} fontSize="64" fontWeight="1000">…SERIOUSLY?</text>
        </g>
      </svg>
    </div>
    <Caption text="Alex looks at the card like it personally betrayed him." t={local} a={0} b={3.8} size={33}/>
  </AbsoluteFill>;
};

const ShotQuestion=({t,frame,fps})=>{
  const local=t-11;
  const s=.75+.25*bounce(frame,fps,11.2);
  return <AbsoluteFill style={{background:"radial-gradient(circle at 50% 45%,#16233a,#0b1018 65%)"}}>
    <svg width="1280" height="720" style={{position:"absolute",inset:0,zIndex:1}}>
      <Stick x={300} y={430} s={1.25} pose={local*2} face="neutral"/>
      <PersonifiedCard x={975} y={360} s={.9} face="smile" tilt={Math.sin(local*3)*3}/>
      <g transform={`translate(640 320) scale(${s})`}>
        <text x="0" y="-55" textAnchor="middle" fill={C.ink} fontSize="34" fontWeight="900">DID IT EARN MORE</text>
        <text x="0" y="30" textAnchor="middle" fill={C.yellow} fontSize="86" fontWeight="1000">THAN IT COST?</text>
      </g>
    </svg>
    <Caption text="So he asks the only useful question:" t={local} a={0} b={3.5} size={31}/>
  </AbsoluteFill>;
};

const ShotMath=({t})=>{
  const local=t-15;
  const points=lerp(local,0,3,0,210);
  const fee=lerp(local,1,3,0,200);
  const net=Math.round(points-fee);
  return <AbsoluteFill style={{backgroundColor:"#0a0f16"}}>
    <svg width="1280" height="720" style={{position:"absolute",inset:0,zIndex:1}}>
      <Stick x={180} y={445} s={1.0} pose={local*5} face={net>=0?"smile":"neutral"}/>
      {Array.from({length:12}).map((_,i)=>{
        const a=i*.18;
        const y=lerp(local,a,a+.8,-50,340+(i%3)*52);
        return <g key={i} transform={`translate(${360+(i%4)*95} ${y})`}>
          <circle r="27" fill="#102518" stroke={C.green} strokeWidth="5"/>
          <text y="9" textAnchor="middle" fill={C.green} fontSize="26" fontWeight="1000">$</text>
        </g>
      })}
      <text x="560" y="470" textAnchor="middle" fill={C.green} fontSize="72" fontWeight="1000">${Math.round(points)}</text>
      <text x="700" y="470" textAnchor="middle" fill={C.ink} fontSize="60" fontWeight="900">−</text>
      <rect x="760" y="368" width="270" height="120" rx="20" fill="#2a0d12" stroke={C.red} strokeWidth="7"/>
      <text x="895" y="448" textAnchor="middle" fill={C.red} fontSize="64" fontWeight="1000">${Math.round(fee)}</text>
      <text x="1080" y="455" textAnchor="middle" fill={C.yellow} fontSize="63" fontWeight="1000">= ${net}</text>
    </svg>
    <Caption text="Last year, his points were worth about $210. The fee was $200." t={local} a={0} b={5.7} size={31}/>
  </AbsoluteFill>;
};

const ShotImpulse=({t})=>{
  const local=t-21;
  const receiptX=lerp(local,.4,1.4,1400,720);
  const hit=local>2.1&&local<2.6?Math.sin(local*55)*14:0;
  return <AbsoluteFill style={{background:"linear-gradient(180deg,#161f2d,#0b1018)"}}>
    <svg width="1280" height="720" style={{position:"absolute",inset:0,zIndex:1}}>
      <rect x="60" y="120" width="1160" height="360" rx="28" fill="#111925" stroke="#26364c" strokeWidth="5"/>
      <text x="120" y="190" fill={C.muted} fontSize="26" fontWeight="900">CHECKOUT</text>
      <Stick x={330+hit} y={430} s={1.3} pose={local*5} face={local>2?"panic":"smile"}/>
      <g transform={`translate(${receiptX} 300) rotate(-6)`}>
        <rect x="-210" y="-105" width="420" height="210" rx="18" fill="#f2eee4" stroke={C.red} strokeWidth="7"/>
        <text x="0" y="-35" textAnchor="middle" fill="#222" fontSize="30" fontWeight="1000">THING ALEX DIDN'T NEED</text>
        <text x="0" y="37" textAnchor="middle" fill={C.red} fontSize="72" fontWeight="1000">$47</text>
      </g>
      <PersonifiedCard x={1020} y={335} s={.72} face="smile" tilt={7}/>
      <text x="1000" y="175" textAnchor="middle" fill={C.green} fontSize="28" fontWeight="1000">"FOR THE POINTS"</text>
    </svg>
    <Caption text="Then he bought a $47 thing he didn't need, just for the points." t={local} a={0} b={5.7} color={C.red} size={32}/>
  </AbsoluteFill>;
};

const ShotPunchline=({t})=>{
  const local=t-27;
  const couponY=lerp(local,0,.7,-220,300);
  return <AbsoluteFill style={{background:"radial-gradient(circle at 55% 45%,#1a2030,#0b1018 70%)"}}>
    <svg width="1280" height="720" style={{position:"absolute",inset:0,zIndex:1}}>
      <Stick x={350} y={445} s={1.45} pose={-local*2} face="annoyed"/>
      <g transform={`translate(820 ${couponY}) rotate(${Math.sin(local*6)*3})`}>
        <rect x="-235" y="-115" width="470" height="230" rx="24" fill="#16231a" stroke={C.green} strokeWidth="8" strokeDasharray="18 12"/>
        <text x="0" y="-20" textAnchor="middle" fill={C.green} fontSize="43" fontWeight="1000">PREMIUM COUPON</text>
        <text x="0" y="44" textAnchor="middle" fill={C.yellow} fontSize="56" fontWeight="1000">COSTS $200</text>
        <line x1="-235" y1="0" x2="-330" y2="100" stroke={C.red} strokeWidth="8"/>
        <line x1="-330" y1="100" x2="-400" y2="80" stroke={C.red} strokeWidth="8"/>
      </g>
    </svg>
    <Caption text="Congratulations, Alex. Your premium card is now a coupon that costs money." t={local} a={0} b={2.95} color={C.yellow} size={34}/>
  </AbsoluteFill>;
};

export const Episode1V5Proof=()=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const t=frame/fps;
  return <AbsoluteFill style={{backgroundColor:C.bg,overflow:"hidden"}}>
    {t>=0&&t<3&&<ShotPaid t={t} frame={frame} fps={fps}/>}
    {t>=3&&t<7&&<ShotBetrayal t={t}/>}
    {t>=7&&t<11&&<ShotReaction t={t}/>}
    {t>=11&&t<15&&<ShotQuestion t={t} frame={frame} fps={fps}/>}
    {t>=15&&t<21&&<ShotMath t={t}/>}
    {t>=21&&t<27&&<ShotImpulse t={t}/>}
    {t>=27&&<ShotPunchline t={t}/>}
    <div style={{position:"absolute",left:16,bottom:10,fontFamily:"Arial",fontSize:12,fontWeight:900,color:"#4f5c70",letterSpacing:1}}>
      V5 VISUAL PARITY PROOF • PUBLICATION DISABLED
    </div>
  </AbsoluteFill>;
};
