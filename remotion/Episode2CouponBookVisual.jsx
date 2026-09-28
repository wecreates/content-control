import React from "react";
import {interpolate} from "remotion";

const K="#111111",W="#f7f1e6",R="#e53935",G="#12a8b4",Y="#d7a51c",P="#fffaf0";
const C={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const I=(v,a,b,x,y)=>interpolate(v,[a,b],[x,y],C);
const E=p=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
const rad=d=>d*Math.PI/180;
const pt=(x,y,len,deg)=>[x+Math.cos(rad(deg))*len,y+Math.sin(rad(deg))*len];

const Text=({x=360,y=105,size=46,color=K,children})=>
  <text x={x} y={y} textAnchor="middle" fill={color} fontFamily="Trebuchet MS,DejaVu Sans,sans-serif" fontWeight="900" fontSize={size} letterSpacing="-1.5">{children}</text>;

const JointLimb=({x,y,a1,a2,l1,l2})=>{
  const e=pt(x,y,l1,a1),h=pt(e[0],e[1],l2,a2);
  return <g><line x1={x} y1={y} x2={e[0]} y2={e[1]}/><line x1={e[0]} y1={e[1]} x2={h[0]} y2={h[1]}/><circle cx={e[0]} cy={e[1]} r="4.5" fill={W}/></g>;
};

const Stick=({x,y,s=1,label="",face="flat",lean=0,bob=0,la1=150,la2=125,ra1=30,ra2=55,ll1=115,ll2=105,rl1=65,rl2=75})=>{
  const mouth=face==="wow"?"M-10 -55 a10 12 0 1 0 20 0 a10 12 0 1 0 -20 0":face==="smile"?"M-16 -64 Q0 -48 16 -64":face==="mad"?"M-16 -54 Q0 -68 16 -54":"M-12 -57 L12 -57";
  return <g transform={`translate(${x} ${y+bob}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-82" r="34" fill={W}/>
    <circle cx="-11" cy="-91" r="4" fill={K} stroke="none"/><circle cx="11" cy="-91" r="4" fill={K} stroke="none"/>
    <path d={mouth}/><line y1="-48" y2="82"/>
    <JointLimb x={0} y={-5} a1={la1} a2={la2} l1={54} l2={52}/><JointLimb x={0} y={-5} a1={ra1} a2={ra2} l1={54} l2={52}/>
    <JointLimb x={0} y={82} a1={ll1} a2={ll2} l1={58} l2={68}/><JointLimb x={0} y={82} a1={rl1} a2={rl2} l1={58} l2={68}/>
    {label&&<text y="-138" textAnchor="middle" fill={K} stroke="none" fontFamily="Trebuchet MS,DejaVu Sans,sans-serif" fontWeight="900" fontSize="20">{label}</text>}
  </g>;
};

const Card=({x,y,rot=0,scale=1,label="PREMIUM"})=><g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
  <rect x="-112" y="-68" width="224" height="136" rx="18" fill={W} stroke={K} strokeWidth="5.5"/>
  <rect x="-86" y="-38" width="42" height="28" rx="5" fill={P} stroke={K} strokeWidth="5"/>
  <Text x={0} y={35} size={25}>{label}</Text>
</g>;

const Coupon=({x,y,w=240,h=105,label,color=G,rot=0})=><g transform={`translate(${x} ${y}) rotate(${rot})`}>
  <path d={`M${-w/2} ${-h/2} H${w/2} V${h/2} H${-w/2} Z`} fill={W} stroke={K} strokeWidth="5.5" strokeDasharray="12 8"/>
  <Text x={0} y={10} size={28} color={color}>{label}</Text>
</g>;

const Calendar=({x,y,p})=><g transform={`translate(${x} ${y})`}>
  <rect x="-150" y="-130" width="300" height="260" rx="22" fill={W} stroke={K} strokeWidth="5.5"/>
  <rect x="-150" y="-130" width="300" height="60" rx="22" fill={G} opacity=".22"/>
  <Text x={0} y={-88} size={32}>CREDIT CALENDAR</Text>
  {[0,1,2].map(r=>[0,1,2,3].map(c=><circle key={r+"-"+c} cx={-105+c*70} cy={-30+r*58} r="16" fill={(r*4+c)<I(p,0,1,1,11)?Y:P} stroke={K} strokeWidth="3"/>))}
</g>;

const scenes=[
({p})=><><Text>Your card has homework.</Text><Card x={360} y={410} rot={I(E(p),0,1,-12,8)} scale={1.1}/><Stick x={360} y={920} s={1.35} label="DAVE" face="wow" la1={I(p,0,1,155,205)} ra1={I(p,0,1,25,-25)}/><Text y={1170} size={31} color={R}>PREMIUM ≠ SIMPLE</Text></>,
({p})=><><Text>Coupon dump.</Text><Stick x={190} y={880} s={1.3} label="DAVE" face="wow"/><Coupon x={470} y={390} label="$15 COFFEE" rot={I(p,0,1,-25,8)}/><Coupon x={430} y={540} label="$20 STREAMING" color={Y} rot={I(p,0,1,18,-4)}/><Coupon x={500} y={690} label="$10 MYSTERY STORE" color={R} rot={I(p,0,1,-8,12)}/></>,
({p})=><><Text>Only this month.</Text><Coupon x={360} y={420} label="$15 COFFEE"/><Calendar x={360} y={720} p={p}/><Text y={1110} size={31}>Miss the month → poof.</Text></>,
({p})=><><Text>Remember Tuesday?</Text><Coupon x={360} y={380} label="$20 STREAMING" color={Y}/><path d={`M130 655 Q360 ${I(p,0,1,900,570)} 590 655`} fill="none" stroke={R} strokeWidth="15" strokeLinecap="round"/><Text y={820} size={54} color={R}>USE IT OR LOSE IT</Text></>,
({p})=><><Text>Dave never shops there.</Text><Stick x={195} y={820} s={1.42} label="DAVE" face="mad"/><Coupon x={500} y={480} label="$10 MYSTERY STORE" color={R}/><Text x={500} y={650} size={31}>0 visits last year</Text><path d={`M430 720 L${I(p,0,1,430,570)} 870`} stroke={R} strokeWidth="14" strokeLinecap="round"/></>,
({p})=><><Text>Chad: “FREE MONEY.”</Text><Stick x={500} y={820} s={1.45} label="CHAD" face="smile" bob={Math.sin(p*Math.PI*2)*8}/><Coupon x={210} y={470} label="FREE?!" color={G}/><Text x={210} y={650} size={35}>air quotes engaged</Text></>,
({p})=><><Text>Points Monk arrives.</Text><Stick x={515} y={850} s={1.5} label="POINTS MONK" face="mad" lean={I(p,0,1,5,-4)} la1={I(p,0,1,150,210)}/><Calendar x={210} y={550} p={p}/><Text y={1130} size={30}>Spreadsheet energy: MAX</Text></>,
({p})=><><Text>Did the credit change you?</Text><Stick x={190} y={860} s={1.25} label="DAVE" face="wow"/><path d="M340 500 H590 V690 H340 Z" fill={P} stroke={K} strokeWidth="5.5"/><Text x={465} y={565} size={30}>WOULD YOU BUY IT</Text><Text x={465} y={625} size={43} color={R}>WITHOUT THE CARD?</Text></>,
({p})=><><Text>If no, it steered you.</Text><path d="M120 540 H590" stroke={K} strokeWidth="6"/><circle cx={I(p,0,1,160,555)} cy="540" r="28" fill={Y} stroke={K} strokeWidth="5"/><Text y={700} size={46} color={R}>CREDIT ≠ SAVINGS</Text><Stick x={360} y={980} s={1.1} label="POINTS MONK" face="flat"/></>,
({p})=><><Text>Count real value only.</Text><rect x="95" y="390" width="530" height="315" rx="26" fill={W} stroke={K} strokeWidth="5.5"/><Text y={485} size={38}>USED ANYWAY</Text><Text y={570} size={65} color={G}>+$45</Text><Text y={655} size={31}>unused coupon = $0</Text></>,
({p})=><><Text>Then subtract the fee.</Text><Text y={390} size={48}>REAL VALUE</Text><Text y={510} size={72} color={G}>$45</Text><Text y={635} size={48}>− ANNUAL FEE</Text><path d="M180 700 H540" stroke={K} strokeWidth="6"/><Text y={800} size={50} color={R}>DO THE MATH</Text></>,
({p})=><><Text>One rule.</Text><Text y={300} size={58} color={G}>REAL VALUE FIRST</Text><Text y={400} size={46}>CREDITS SECOND</Text><Text y={500} size={44} color={R}>FLEX LAST</Text><Stick x={220} y={850} s={1.25} label="DAVE" face="smile"/><Stick x={500} y={850} s={1.25} label="POINTS MONK" face="smile"/><Text y={1170} size={30}>You do not have to finish the coupon book.</Text></>
];

const cuts=[0,2.5,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30];

export const Episode2CouponBookVisual=({frame})=>{
  const t=frame/24;
  let n=cuts.length-2;
  for(let k=0;k<cuts.length-1;k++){if(t>=cuts[k]&&t<cuts[k+1]){n=k;break;}}
  const start=cuts[n],end=cuts[n+1],p=Math.max(0,Math.min(1,(t-start)/(end-start)));
  const Scene=scenes[n];
  const zoom=1+0.03*Math.sin(Math.PI*p);
  const shift=[0,-5,5,-4,6,-5,4,-6,5,-4,4,0][n];
  const jitterX=Math.sin(frame*0.42+n)*1.2;
  const jitterY=Math.cos(frame*0.31+n*.7)*.8;
  return <div style={{position:"absolute",inset:0,background:W,overflow:"hidden",backgroundImage:"radial-gradient(circle at 20% 15%,rgba(0,0,0,.025) 0 1px,transparent 1.4px)",backgroundSize:"18px 18px"}}>
    <svg width="720" height="1280" viewBox="0 0 720 1280" style={{transform:`translate(${shift+jitterX}px,${jitterY}px) scale(${zoom}) rotate(${Math.sin(frame*.08+n)*.11}deg)`,transformOrigin:"center"}}>
      <Scene p={p}/>
    </svg>
  </div>;
};
