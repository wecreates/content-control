import React from "react";
import {interpolate} from "remotion";

const K="#111111",W="#ffffff",R="#e53935",G="#16a34a",Y="#d7a51c",P="#f4f4f4";
const C={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const I=(v,a,b,x,y)=>interpolate(v,[a,b],[x,y],C);
const E=(p)=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
const rad=(d)=>d*Math.PI/180;
const pt=(x,y,len,deg)=>[x+Math.cos(rad(deg))*len,y+Math.sin(rad(deg))*len];

const Text=({x=360,y=105,size=42,color=K,children})=>
  <text x={x} y={y} textAnchor="middle" fill={color} fontFamily="Arial,Helvetica,sans-serif" fontWeight="900" fontSize={size}>{children}</text>;

const JointLimb=({x,y,a1,a2,l1,l2})=>{
  const e=pt(x,y,l1,a1), h=pt(e[0],e[1],l2,a2);
  return <g><line x1={x} y1={y} x2={e[0]} y2={e[1]}/><line x1={e[0]} y1={e[1]} x2={h[0]} y2={h[1]}/><circle cx={e[0]} cy={e[1]} r="4.5" fill={W}/></g>;
};

const Stick=({x,y,s=1,label="",face="flat",lean=0,bob=0,la1=150,la2=125,ra1=30,ra2=55,ll1=115,ll2=105,rl1=65,rl2=75})=>{
  const mouth=face==="wow"?"M-10 -55 a10 12 0 1 0 20 0 a10 12 0 1 0 -20 0":face==="smile"?"M-16 -64 Q0 -48 16 -64":face==="mad"?"M-16 -54 Q0 -68 16 -54":"M-12 -57 L12 -57";
  return <g transform={`translate(${x} ${y+bob}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-82" r="34" fill={W}/>
    <circle cx="-11" cy="-91" r="4" fill={K} stroke="none"/><circle cx="11" cy="-91" r="4" fill={K} stroke="none"/>
    <path d={mouth}/><line y1="-48" y2="82"/>
    <JointLimb x={0} y={-5} a1={la1} a2={la2} l1={54} l2={52}/><JointLimb x={0} y={-5} a1={ra1} a2={ra2} l1={54} l2={52}/>
    <JointLimb x={0} y={82} a1={ll1} a2={ll2} l1={58} l2={68}/><JointLimb x={0} y={82} a1={rl1} a2={rl2} l1={58} l2={68}/>
    {label&&<text y="-138" textAnchor="middle" fill={K} stroke="none" fontFamily="Arial" fontWeight="900" fontSize="20">{label}</text>}
  </g>;
};

const Card=({x,y,rot=0,scale=1,label="EXAMPLE $695"})=><g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
  <rect x="-112" y="-68" width="224" height="136" rx="18" fill={W} stroke={K} strokeWidth="7"/>
  <rect x="-86" y="-38" width="42" height="28" rx="5" fill={P} stroke={K} strokeWidth="5"/>
  <Text x={0} y={35} size={25}>{label}</Text>
</g>;

const Meter=({v,color})=><g><rect x="110" y="460" width="500" height="54" rx="27" fill={P} stroke={K} strokeWidth="6"/><rect x="114" y="464" width={492*v} height="46" rx="23" fill={color}/></g>;

const scenes=[
({p})=><><Text>THE FEE SHOWS UP.</Text><g transform={`translate(${I(E(p),0,1,-120,0)} 0)`}><rect x="85" y="400" width="210" height="220" rx="14" fill={W} stroke={K} strokeWidth="7"/><path d="M85 435 L190 520 L295 435" fill="none" stroke={K} strokeWidth="7"/><Text x={190} y={575} size={28} color={R}>$695</Text></g><Stick x={505} y={760} s={1.28} label="DAVE" face={p>.35?"wow":"flat"} ra1={I(p,0,1,20,-40)} ra2={I(p,0,1,45,-70)} lean={I(p,0,1,0,-4)}/><Text y={1160} size={30}>MAILBOX: 1 • JOY: 0</Text></>,
({p})=><><Text>AGAIN?</Text><Stick x={205} y={765} s={1.45} label="DAVE" face="wow" la1={I(p,0,1,155,205)} la2={I(p,0,1,130,220)} ra1={I(p,0,1,25,-20)} ra2={I(p,0,1,50,-55)} lean={I(p,0,1,-6,5)}/><Card x={505} y={500} rot={I(p,0,1,-22,10)} scale={I(p,0,.28,.55,1.18)}/><Text x={505} y={700} size={34} color={R}>NOT A FLEX.</Text></>,
({p})=><><Text>CHAD HAS A “HACK.”</Text><Stick x={520} y={760} s={1.32} label="CHAD" face="smile" la1={I(p,0,1,150,205)} la2={I(p,0,1,125,220)} ra1={I(p,0,1,25,-25)} ra2={I(p,0,1,55,-50)} bob={Math.sin(p*Math.PI*2)*7}/><g transform={`translate(${I(E(p),0,1,-210,0)} 0)`}><rect x="75" y="410" width="300" height="180" rx="20" fill={W} stroke={K} strokeWidth="7"/><Text x={225} y={485} size={35}>SPEND $80</Text><Text x={225} y={545} size={36} color={G}>“SAVE” $20</Text></g><Text y={1110} size={29}>CHAD LOVES AIR QUOTES.</Text></>,
({p})=><><Text>HERE’S THE CATCH.</Text><rect x="70" y="410" width="580" height="320" rx="26" fill={P} stroke={K} strokeWidth="7"/><Text x={165} y={500} size={30}>CART</Text><Text x={165} y={585} size={47}>$80</Text><path d="M310 450 V700" stroke={K} strokeWidth="6"/><Text x={480} y={500} size={30}>CREDIT</Text><Text x={480} y={585} size={47} color={G}>−$20</Text><path d={`M390 665 H${I(p,0,1,390,560)}`} stroke={G} strokeWidth="16" strokeLinecap="round"/><Text y={845} size={51} color={R}>YOU STILL SPEND $60.</Text></>,
({p})=><><Text>THE RECEIPT DOESN’T CARE.</Text><g transform={`translate(360 ${I(p,0,.4,280,520)})`}><path d="M-150 -150 H150 V150 L120 130 L90 150 L60 130 L30 150 L0 130 L-30 150 L-60 130 L-90 150 L-120 130 L-150 150 Z" fill={W} stroke={K} strokeWidth="7"/><Text x={0} y={-65} size={30}>TOTAL PAID</Text><Text x={0} y={30} size={70} color={R}>$60</Text></g><Stick x={360} y={950} s={1.0} label="DAVE" face="wow" la1={I(p,0,1,150,215)} la2={I(p,0,1,125,230)} ra1={I(p,0,1,30,-35)} ra2={I(p,0,1,55,-60)}/></>,
({p})=><><Text>POINTS MONK INTERRUPTS.</Text><Stick x={520} y={780} s={1.32} label="POINTS MONK" face="mad" la1={I(p,0,1,150,210)} la2={I(p,0,1,125,220)} ra1={I(p,0,1,30,-35)} ra2={I(p,0,1,55,-65)} lean={I(p,0,1,4,-4)}/><g transform={`translate(${I(E(p),0,1,-170,0)} 0)`}><circle cx="190" cy="520" r="115" fill={W} stroke={K} strokeWidth="7"/><Text x={190} y={500} size={31}>CREDIT</Text><Text x={190} y={555} size={31}>≠ FREE</Text><path d="M110 440 L270 600 M270 440 L110 600" stroke={R} strokeWidth="16" strokeLinecap="round"/></g></>,
({p})=><><Text>DO THE ACTUAL MATH.</Text><rect x="115" y="390" width="490" height="300" rx="28" fill={W} stroke={K} strokeWidth="7"/><Text x={360} y={495} size={58}>$80 − $20</Text><line x1="180" y1="545" x2="540" y2="545" stroke={K} strokeWidth="6"/><Text x={360} y={645} size={73} color={R}>$60</Text><Stick x={360} y={950} s={.95} label="POINTS MONK" la1={I(p,0,1,150,190)} la2={I(p,0,1,125,180)} ra1={I(p,0,1,30,-10)} ra2={I(p,0,1,55,-30)}/></>,
({p})=><><Text>DAVE CHECKS HIS WALLET.</Text><Stick x={180} y={790} s={1.2} label="DAVE" face="wow" ra1={I(p,0,1,25,-15)} ra2={I(p,0,1,50,-35)}/><g transform="translate(490 545)"><rect x="-100" y="-60" width="200" height="120" rx="18" fill={W} stroke={K} strokeWidth="7"/><rect x={I(p,0,1,-65,115)} y="-32" width="130" height="64" fill={W} stroke={G} strokeWidth="6"/><Text x={I(p,0,1,0,180)} y={10} size={27} color={G}>$60</Text></g><Text x={490} y={770} size={34} color={R}>CASH LEFT THE CHAT.</Text></>,
({p})=><><Text>NOW COMPARE REAL VALUE.</Text><g transform="translate(360 585)"><line x1="-210" y1="0" x2="210" y2="0" stroke={K} strokeWidth="9"/><line y1="-90" y2="120" stroke={K} strokeWidth="9"/><path d="M-150 0 L-210 140 H-90 Z M150 0 L90 140 H210 Z" fill={W} stroke={K} strokeWidth="7"/><Text x={-150} y={190} size={28}>REAL VALUE</Text><Text x={150} y={190} size={28}>ANNUAL FEE</Text><circle cx={I(p,0,1,-90,90)} cy="-45" r="28" fill={Y} stroke={K} strokeWidth="6"/></g><Text y={1015} size={30}>COUNT ONLY WHAT YOU’D BUY ANYWAY.</Text></>,
({p})=><><Text color={G}>VALUE WINS?</Text><Meter v={I(p,0,1,0,.88)} color={G}/><Text y={610} size={62} color={G}>MAYBE KEEP IT.</Text><Stick x={360} y={930} s={1.04} label="POINTS MONK" face="smile" la1={I(p,0,1,150,205)} la2={I(p,0,1,125,220)} ra1={I(p,0,1,30,-25)} ra2={I(p,0,1,55,-55)}/></>,
({p})=><><Text color={R}>VALUE LOSES?</Text><Meter v={I(p,0,1,0,.33)} color={R}/><Text y={610} size={62} color={R}>RETHINK IT.</Text><Card x={360} y={835} rot={I(p,0,1,-6,10)} scale={.85} label="CUT THE FLEX"/><path d={`M${I(p,0,1,190,285)} 735 L${I(p,0,1,530,435)} 930`} stroke={R} strokeWidth="14" strokeLinecap="round"/></>,
({p})=><><Text>ONE RULE.</Text><Text y={270} size={70} color={G}>REAL VALUE &gt; FEE</Text><Stick x={225} y={790} s={1.12} label="DAVE" face="smile" lean={I(p,0,1,-3,3)} la1={I(p,0,1,150,205)} la2={I(p,0,1,125,220)}/><Stick x={495} y={790} s={1.12} label="POINTS MONK" face="smile" lean={I(p,0,1,3,-3)} ra1={I(p,0,1,30,-25)} ra2={I(p,0,1,55,-55)}/><path d="M150 1050 Q360 1120 570 1050" fill="none" stroke={G} strokeWidth="12" strokeLinecap="round"/><Text y={1180} size={31}>IGNORE THE FLEX. KEEP THE MATH.</Text></>
];

const cuts=[0,2,4.5,7,9.5,12,14.5,17,19.5,22,24.5,27,30];

export const V9ArticulatedVisual=({frame})=>{
  const t=frame/24;
  let n=cuts.length-2;
  for(let k=0;k<cuts.length-1;k++){if(t>=cuts[k]&&t<cuts[k+1]){n=k;break;}}
  const start=cuts[n], end=cuts[n+1], p=Math.max(0,Math.min(1,(t-start)/(end-start)));
  const Scene=scenes[n];
  const zoom=1+0.015*Math.sin(Math.PI*p);
  const shift=[0,-4,5,-3,4,-5,3,-4,4,-2,2,0][n];
  return <div style={{position:"absolute",inset:0,background:W,overflow:"hidden"}}>
    <svg width="720" height="1280" viewBox="0 0 720 1280" style={{transform:`translateX(${shift}px) scale(${zoom})`,transformOrigin:"center"}}>
      <Scene p={p}/>
    </svg>
  </div>;
};
