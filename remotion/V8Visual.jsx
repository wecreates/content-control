import React from "react";
import {interpolate} from "remotion";

const K="#111111", W="#ffffff", R="#e53935", G="#16a34a", Y="#d7a51c", P="#f4f4f4";
const C={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const I=(v,a,b,x,y)=>interpolate(v,[a,b],[x,y],C);
const ease=(p)=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;

const Text=({x=360,y=110,size=42,color=K,children,anchor="middle"})=>
  <text x={x} y={y} textAnchor={anchor} fill={color} fontFamily="Arial,Helvetica,sans-serif" fontWeight="900" fontSize={size}>{children}</text>;

const Stick=({x,y,s=1,face="flat",armL=-60,armR=60,leg=0,label="",lean=0})=>{
  const mouth=face==="wow"?"M-10 -55 a10 12 0 1 0 20 0 a10 12 0 1 0 -20 0":face==="smile"?"M-16 -64 Q0 -48 16 -64":face==="mad"?"M-16 -54 Q0 -68 16 -54":"M-12 -57 L12 -57";
  const lEl=[armL*.52,14+Math.abs(armL)*.10], rEl=[armR*.52,8+Math.abs(armR)*.08];
  const lK=[-26-leg*.42,124], rK=[26+leg*.42,124];
  return <g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-82" r="34" fill={W}/>
    <circle cx="-11" cy="-91" r="4" fill={K} stroke="none"/><circle cx="11" cy="-91" r="4" fill={K} stroke="none"/>
    <path d={mouth}/>
    <line y1="-48" y2="82"/>
    <polyline points={`0,-4 ${lEl[0]},${lEl[1]} ${armL},34`}/><polyline points={`0,-4 ${rEl[0]},${rEl[1]} ${armR},18`}/>
    <polyline points={`0,82 ${lK[0]},${lK[1]} ${-50-leg},168`}/><polyline points={`0,82 ${rK[0]},${rK[1]} ${50+leg},168`}/>
    <circle cx={lEl[0]} cy={lEl[1]} r="4.5" fill={W}/><circle cx={rEl[0]} cy={rEl[1]} r="4.5" fill={W}/>
    <circle cx={lK[0]} cy={lK[1]} r="4.5" fill={W}/><circle cx={rK[0]} cy={rK[1]} r="4.5" fill={W}/>
    {label&&<text y="-135" textAnchor="middle" fill={K} stroke="none" fontFamily="Arial" fontWeight="900" fontSize="20">{label}</text>}
  </g>;
};

const Card=({x,y,rot=0,scale=1,label="EXAMPLE $695"})=><g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
  <rect x="-112" y="-68" width="224" height="136" rx="18" fill={W} stroke={K} strokeWidth="7"/>
  <rect x="-86" y="-38" width="42" height="28" rx="5" fill={P} stroke={K} strokeWidth="5"/>
  <Text x={0} y={35} size={25}>{label}</Text>
</g>;

const Wallet=({x,y,cash=0})=><g transform={`translate(${x} ${y})`}>
  <rect x="-90" y="-55" width="180" height="110" rx="18" fill={W} stroke={K} strokeWidth="7"/>
  <rect x="25" y="-12" width="75" height="40" rx="9" fill={P} stroke={K} strokeWidth="6"/>
  {cash>0&&<g transform={`translate(${I(cash,0,1,0,150)} 0)`}><rect x="-65" y="-32" width="130" height="64" fill={W} stroke={G} strokeWidth="6"/><Text x={0} y={10} size={27} color={G}>$60</Text></g>}
</g>;

const Meter=({x=110,y=460,w=500,v=.5,color=G})=><g>
  <rect x={x} y={y} width={w} height="54" rx="27" fill={P} stroke={K} strokeWidth="6"/>
  <rect x={x+4} y={y+4} width={(w-8)*v} height="46" rx="23" fill={color}/>
</g>;

const Scene0=({p})=><>
  <Text>THE FEE SHOWS UP.</Text>
  <g transform={`translate(${I(ease(p),0,1,80,0)} 0)`}>
    <rect x="95" y="410" width="180" height="200" rx="12" fill={W} stroke={K} strokeWidth="7"/>
    <path d="M95 440 L185 515 L275 440" fill="none" stroke={K} strokeWidth="7"/>
    <Text x={185} y={555} size={18}>EXAMPLE</Text><Text x={185} y={590} size={28} color={R}>$695</Text>
  </g>
  <Stick x={500} y={720} s={1.25} face={p>.35?"wow":"flat"} armL={-55} armR={I(p,0,1,45,100)} label="DAVE"/>
  <path d="M90 1010 H630" stroke={K} strokeWidth="7"/>
  <Text y={1160} size={31}>MAILBOX: 1 • JOY: 0</Text>
</>;

const Scene1=({p})=><>
  <Text>AGAIN?</Text>
  <Stick x={210} y={760} s={1.45} face="wow" armL={-85} armR={80} label="DAVE" lean={I(p,0,1,-5,4)}/>
  <Card x={500} y={500} rot={I(p,0,1,-18,8)} scale={I(p,0,.25,.6,1.15)}/>
  <g opacity={I(p,.3,.55,0,1)}>
    <Text x={500} y={690} size={34} color={R}>NOT A FLEX.</Text>
  </g>
</>;

const Scene2=({p})=><>
  <Text>CHAD HAS A “HACK.”</Text>
  <Stick x={520} y={760} s={1.3} face="smile" armL={-100} armR={95} label="CHAD" lean={I(p,0,1,7,-4)}/>
  <g transform={`translate(${I(ease(p),0,1,-180,0)} 0)`}>
    <rect x="85" y="420" width="290" height="170" rx="20" fill={W} stroke={K} strokeWidth="7"/>
    <Text x={230} y={485} size={35}>SPEND $80</Text>
    <Text x={230} y={545} size={36} color={G}>“SAVE” $20</Text>
  </g>
  <Text y={1110} size={29}>CHAD LOVES AIR QUOTES.</Text>
</>;

const Scene3=({p})=><>
  <Text>HERE’S THE CATCH.</Text>
  <rect x="70" y="420" width="580" height="310" rx="26" fill={P} stroke={K} strokeWidth="7"/>
  <Text x={165} y={500} size={30}>CART</Text><Text x={165} y={585} size={47}>$80</Text>
  <path d="M310 450 V700" stroke={K} strokeWidth="6"/>
  <Text x={480} y={500} size={30}>CREDIT</Text><Text x={480} y={585} size={47} color={G}>−$20</Text>
  <path d={`M390 665 H${I(p,0,1,390,560)}`} stroke={G} strokeWidth="16" strokeLinecap="round"/>
  <Text y={840} size={51} color={R}>YOU STILL SPEND $60.</Text>
</>;

const Scene4=({p})=><>
  <Text>THE RECEIPT DOESN’T CARE.</Text>
  <g transform={`translate(360 ${I(p,0,.35,320,510)})`}>
    <path d="M-150 -150 H150 V150 L120 130 L90 150 L60 130 L30 150 L0 130 L-30 150 L-60 130 L-90 150 L-120 130 L-150 150 Z" fill={W} stroke={K} strokeWidth="7"/>
    <Text x={0} y={-65} size={30}>TOTAL PAID</Text>
    <Text x={0} y={30} size={70} color={R}>$60</Text>
  </g>
  <Stick x={360} y={930} s={1.05} face="wow" armL={-70} armR={70} label="DAVE"/>
</>;

const Scene5=({p})=><>
  <Text>POINTS MONK INTERRUPTS.</Text>
  <Stick x={515} y={780} s={1.3} face="mad" armL={-110} armR={I(p,0,1,55,115)} label="POINTS MONK"/>
  <g transform={`translate(${I(ease(p),0,1,-160,0)} 0)`}>
    <circle cx="190" cy="520" r="115" fill={W} stroke={K} strokeWidth="7"/>
    <Text x={190} y={500} size={31}>CREDIT</Text><Text x={190} y={555} size={31}>≠ FREE</Text>
    <path d="M110 440 L270 600 M270 440 L110 600" stroke={R} strokeWidth="16" strokeLinecap="round"/>
  </g>
</>;

const Scene6=({p})=><>
  <Text>DO THE ACTUAL MATH.</Text>
  <rect x="115" y="390" width="490" height="300" rx="28" fill={W} stroke={K} strokeWidth="7"/>
  <Text x={360} y={495} size={58}>$80 − $20</Text>
  <line x1="180" y1="545" x2="540" y2="545" stroke={K} strokeWidth="6"/>
  <Text x={360} y={645} size={73} color={R}>$60</Text>
  <Stick x={360} y={940} s={.95} face="flat" armL={-95} armR={95} label="POINTS MONK"/>
</>;

const Scene7=({p})=><>
  <Text>DAVE CHECKS HIS WALLET.</Text>
  <Stick x={175} y={790} s={1.2} face="wow" armL={-70} armR={95} label="DAVE"/>
  <Wallet x={470} y={550} cash={p}/>
  <Text x={470} y={770} size={34} color={R}>CASH LEFT THE CHAT.</Text>
</>;

const Scene8=({p})=><>
  <Text>NOW COMPARE REAL VALUE.</Text>
  <g transform="translate(360 585)">
    <line x1="-210" y1="0" x2="210" y2="0" stroke={K} strokeWidth="9"/>
    <line y1="-90" y2="120" stroke={K} strokeWidth="9"/>
    <path d="M-150 0 L-210 140 H-90 Z M150 0 L90 140 H210 Z" fill={W} stroke={K} strokeWidth="7"/>
    <Text x={-150} y={190} size={28}>REAL VALUE</Text><Text x={150} y={190} size={28}>ANNUAL FEE</Text>
    <circle cx={I(p,0,1,-80,80)} cy="-45" r="28" fill={Y} stroke={K} strokeWidth="6"/>
  </g>
  <Text y={1010} size={30}>COUNT ONLY WHAT YOU’D BUY ANYWAY.</Text>
</>;

const Scene9=({p})=><>
  <Text color={G}>VALUE WINS?</Text>
  <Meter v={I(p,0,1,0,.88)} color={G}/>
  <Text y={610} size={62} color={G}>MAYBE KEEP IT.</Text>
  <Stick x={360} y={900} s={1.05} face="smile" armL={-90} armR={90} label="POINTS MONK"/>
</>;

const Scene10=({p})=><>
  <Text color={R}>VALUE LOSES?</Text>
  <Meter v={I(p,0,1,0,.33)} color={R}/>
  <Text y={610} size={62} color={R}>RETHINK IT.</Text>
  <Card x={360} y={830} rot={I(p,0,1,-3,8)} scale={.85} label="CUT THE FLEX"/>
  <path d={`M${I(p,0,1,190,285)} 735 L${I(p,0,1,530,435)} 930`} stroke={R} strokeWidth="14" strokeLinecap="round"/>
</>;

const Scene11=({p})=><>
  <Text>ONE RULE.</Text>
  <Text y={270} size={70} color={G}>REAL VALUE &gt; FEE</Text>
  <Stick x={225} y={780} s={1.15} face="smile" armL={-85} armR={85} label="DAVE" lean={I(p,0,1,-2,2)}/>
  <Stick x={495} y={780} s={1.15} face="smile" armL={-85} armR={85} label="POINTS MONK" lean={I(p,0,1,2,-2)}/>
  <path d="M150 1050 Q360 1120 570 1050" fill="none" stroke={G} strokeWidth="12" strokeLinecap="round"/>
  <Text y={1180} size={31}>IGNORE THE FLEX. KEEP THE MATH.</Text>
</>;

const scenes=[Scene0,Scene1,Scene2,Scene3,Scene4,Scene5,Scene6,Scene7,Scene8,Scene9,Scene10,Scene11];

export const V8Visual=({frame})=>{
  const t=frame/24;
  const n=Math.min(11,Math.floor(t/2.5));
  const p=(t-n*2.5)/2.5;
  const S=scenes[n];
  const zoom=1+0.018*Math.sin(Math.PI*p);
  const shift=[0,-5,6,-4,5,-6,4,-5,5,-3,3,0][n];
  return <div style={{position:"absolute",inset:0,background:W,overflow:"hidden"}}>
    <svg width="720" height="1280" viewBox="0 0 720 1280" style={{transform:`translateX(${shift}px) scale(${zoom})`,transformOrigin:"center"}}>
      <S p={p}/>
    </svg>
  </div>;
};
