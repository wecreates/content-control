import React from "react";
import {interpolate,spring} from "remotion";

const K="#111111", C="#18a9b8", PAPER="#f4f0e6";
const clamp={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const I=(v,a,b,x,y)=>interpolate(v,[a,b],[x,y],clamp);
const wob=(frame,phase=0,amp=2)=>Math.sin((frame+phase)/7)*amp;

const Paper=()=> <g>
  <rect width="720" height="1280" fill={PAPER}/>
  {Array.from({length:90},(_,i)=>{
    const x=(i*83)%720, y=(i*149)%1280, r=1+(i%3)*.35;
    return <circle key={i} cx={x} cy={y} r={r} fill="#6e675a" opacity={0.025+(i%4)*0.008}/>;
  })}
</g>;

const Headline=({a,b,frame})=>{
  const s=spring({frame,fps:24,config:{damping:16,stiffness:140,mass:.7}});
  return <g transform={`translate(360 ${I(s,0,1,120,150)}) scale(${I(s,0,1,.92,1)})`} opacity={s}>
    <text x="0" y="0" textAnchor="middle" fill={K} fontFamily="'Arial Rounded MT Bold','Trebuchet MS',Arial,sans-serif" fontWeight="900" fontSize="82" letterSpacing="-2">{a}</text>
    <text x="0" y="105" textAnchor="middle" fill={C} fontFamily="'Arial Rounded MT Bold','Trebuchet MS',Arial,sans-serif" fontWeight="900" fontSize="88" letterSpacing="-2">{b}</text>
  </g>;
};

const Face=({mood="smile"})=>{
  const mouth=mood==="worried"?"M-24 18 Q0 0 24 18":mood==="wow"?"M0 6 a10 13 0 1 0 .1 0":mood==="smirk"?"M-22 12 Q3 28 25 6":"M-24 7 Q0 30 24 7";
  return <g stroke={K} strokeWidth="4" fill="none" strokeLinecap="round">
    <ellipse cx="-16" cy="-8" rx="5" ry="8" fill={K}/>
    <ellipse cx="16" cy="-8" rx="5" ry="8" fill={K}/>
    <path d={mouth}/>
  </g>;
};

const Person=({x=360,y=840,s=1,kind="dave",mood="smile",pose="rest",frame=0,mirror=false})=>{
  const sign=mirror?-1:1;
  const bob=wob(frame,kind==="dave"?0:kind==="chad"?13:27,3);
  const arm=I(Math.min(1,frame/18),0,1,0,1);
  let left="M0 65 Q-45 105 -78 145", right="M0 65 Q45 105 78 145";
  if(pose==="point") right=`M0 65 Q${65*sign} 70 ${130*sign} ${80-wob(frame,0,6)}`;
  if(pose==="shrug"){left="M0 65 Q-60 70 -110 35";right="M0 65 Q60 70 110 35";}
  if(pose==="present"){left="M0 65 Q-55 100 -100 90";right="M0 65 Q55 100 100 90";}
  if(pose==="cross"){left="M0 65 Q-40 105 55 118";right="M0 65 Q40 105 -55 118";}
  const hair=kind==="chad"
    ? <><path d="M-45 -82 Q-5 -116 45 -86"/><path d="M-45 -80 Q0 -58 48 -76"/></>
    : kind==="monk"
    ? <><path d="M-20 -100 L-9 -119 M0 -101 L11 -121 M20 -98 L31 -116"/></>
    : <><path d="M-30 -98 L-16 -116 M-10 -102 L3 -120 M12 -100 L25 -115"/></>;
  return <g transform={`translate(${x} ${y+bob}) scale(${s})`} stroke={K} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-55" r="58" fill={PAPER}/>
    {hair}
    {kind==="chad"&&<path d="M-48 -83 Q0 -109 52 -81 L74 -72 Q35 -63 17 -66" fill={PAPER}/>}
    <g transform="translate(0 -55)"><Face mood={mood}/></g>
    <path d="M0 3 Q-5 90 0 185"/>
    {kind==="monk"&&<path d="M0 18 L-16 48 L0 85 L16 48 Z" fill={K}/>}
    <path d={left}/><path d={right}/>
    <circle cx={pose==="shrug"?-110:-78} cy={pose==="shrug"?35:145} r="7" fill={PAPER}/>
    <circle cx={pose==="shrug"?110:pose==="point"?130:78} cy={pose==="shrug"?35:pose==="point"?80:145} r="7" fill={PAPER}/>
    <path d="M0 185 Q-26 250 -35 330"/><path d="M0 185 Q28 252 39 330"/>
    <ellipse cx="-38" cy="334" rx="18" ry="6"/><ellipse cx="43" cy="334" rx="18" ry="6"/>
    {pose==="point"&&<g opacity={arm}><path d={`M${145*sign} 62 l${18*sign} -10 M${146*sign} 80 l${20*sign} 0 M${145*sign} 98 l${18*sign} 11`}/></g>}
  </g>;
};

const Envelope=({x=355,y=760,frame=0})=><g transform={`translate(${x} ${y}) rotate(${wob(frame,0,2)})`} stroke={K} strokeWidth="5" fill={PAPER} strokeLinejoin="round">
  <rect x="-120" y="-78" width="240" height="156" rx="16"/><path d="M-120 -55 L0 28 L120 -55"/>
  <text x="0" y="62" textAnchor="middle" fill={C} stroke="none" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="36">$695</text>
</g>;

const Card=({x=360,y=790,frame=0})=><g transform={`translate(${x} ${y}) rotate(${-5+wob(frame,3,3)})`} stroke={K} strokeWidth="5" fill={PAPER}>
  <rect x="-130" y="-76" width="260" height="152" rx="20"/><rect x="-96" y="-36" width="45" height="30" rx="5"/>
  <text x="10" y="30" textAnchor="middle" fill={C} stroke="none" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="38">$20</text>
</g>;

const MathBoard=({frame})=><g transform={`translate(360 765) scale(${1+wob(frame,0,.006)})`} stroke={K} strokeWidth="5" fill="none" strokeLinecap="round">
  <rect x="-220" y="-145" width="440" height="290" rx="18"/>
  <text x="0" y="-40" textAnchor="middle" fill={K} stroke="none" fontFamily="'Arial Rounded MT Bold',Arial,sans-serif" fontWeight="900" fontSize="62">$80 - $20</text>
  <path d="M-120 5 H120"/>
  <text x="0" y="105" textAnchor="middle" fill={C} stroke="none" fontFamily="'Arial Rounded MT Bold',Arial,sans-serif" fontWeight="900" fontSize="86">$60</text>
</g>;

const Wallet=({frame})=><g transform={`translate(360 785) rotate(${wob(frame,0,2)})`} stroke={K} strokeWidth="5" fill={PAPER}>
  <path d="M-165 -75 H150 Q175 -75 175 -48 V75 H-165 Q-185 75 -185 55 V-55 Q-185 -75 -165 -75 Z"/>
  <rect x="55" y="-25" width="120" height="70" rx="12"/>
  <circle cx="78" cy="10" r="7" fill={C}/>
  <path d="M-95 -95 L-35 -95 M-75 -112 L-15 -112"/>
</g>;

const Coins=({frame})=><g transform="translate(360 820)" stroke={K} strokeWidth="4" fill={PAPER}>
  {[0,1,2,3,4].map((r)=><g key={r} transform={`translate(0 ${-r*34})`}><ellipse cx="0" cy="0" rx={145-r*5} ry="28"/><path d="M-145 0 V24 Q0 48 145 24 V0"/></g>)}
  <text x="0" y="-185" textAnchor="middle" fill={C} stroke="none" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="48">REAL VALUE</text>
</g>;

const Scale=({frame,valueWins=true})=><g transform="translate(360 820)" stroke={K} strokeWidth="5" fill="none" strokeLinecap="round">
  <path d={`M0 -160 L0 120 M-190 ${valueWins?-45:-5} H190`} />
  <path d={`M-125 ${valueWins?-45:-5} L-175 80 H-75 Z M125 ${valueWins?-45:-5} L75 80 H175 Z`} />
  <text x="-125" y="135" textAnchor="middle" fill={valueWins?C:K} stroke="none" fontFamily="Arial" fontWeight="900" fontSize="28">VALUE</text>
  <text x="125" y="135" textAnchor="middle" fill={valueWins?K:C} stroke="none" fontFamily="Arial" fontWeight="900" fontSize="28">FEE</text>
</g>;

const Handshake=({frame})=><g transform="translate(360 805)" stroke={K} strokeWidth="5" fill={PAPER} strokeLinecap="round" strokeLinejoin="round">
  <path d="M-240 40 Q-160 -20 -78 20 L-20 70 Q5 92 32 68 L78 25 Q150 -20 240 40"/>
  <path d="M-20 70 Q25 120 75 58 M-5 88 Q25 138 88 70 M10 100 Q45 142 96 82"/>
  <path d={`M-42 -18 q12 ${-14+wob(frame,0,3)} 24 0 M42 -18 q12 ${-14+wob(frame,3,3)} 24 0`}/>
</g>;

const scenes=[
({f})=><><Headline a="Annual Fee" b="$695 Again" frame={f}/><Envelope x={220} y={770} frame={f}/><Person x={510} y={825} s={1.05} kind="dave" mood="wow" pose="shrug" frame={f}/></>,
({f})=><><Headline a="Chad Says" b="Free Credit" frame={f}/><Person x={220} y={830} s={1.05} kind="chad" mood="smirk" pose="point" frame={f}/><Card x={500} y={770} frame={f}/></>,
({f})=><><Headline a="$80 Spent" b="$20 Back" frame={f}/><Person x={210} y={830} s={1.0} kind="dave" mood="worried" pose="rest" frame={f}/><Card x={505} y={745} frame={f}/><path d="M430 900 Q505 940 585 905" stroke={C} strokeWidth="8" fill="none" strokeLinecap="round"/></>,
({f})=><><Headline a="The Math" b="Is $60" frame={f}/><MathBoard frame={f}/></>,
({f})=><><Headline a="Credit Isn't" b="Free" frame={f}/><Wallet frame={f}/><Person x={550} y={920} s={.82} kind="dave" mood="worried" pose="shrug" frame={f}/></>,
({f})=><><Headline a="Count What" b="You'd Buy" frame={f}/><Person x={500} y={840} s={1.0} kind="monk" mood="smile" pose="point" frame={f}/><g transform="translate(215 790)" stroke={K} strokeWidth="4" fill={PAPER}><rect x="-100" y="-145" width="200" height="290" rx="12"/>{[-85,-25,35,95].map((y,i)=><g key={i}><circle cx="-60" cy={y} r="10"/><path d={`M-30 ${y} H65`}/></g>)}<path d="M-69 -88 l8 8 l16 -20 M-69 -28 l8 8 l16 -20" stroke={C} strokeWidth="6"/></g></>,
({f})=><><Headline a="Real Value" b="Vs Fee" frame={f}/><Coins frame={f}/></>,
({f})=><><Headline a="Value Wins" b="Keep It" frame={f}/><Scale frame={f} valueWins={true}/><Person x={555} y={920} s={.78} kind="dave" mood="smile" pose="present" frame={f}/></>,
({f})=><><Headline a="Fee Wins" b="Rethink It" frame={f}/><Scale frame={f} valueWins={false}/><Card x={165} y={1010} frame={f}/><path d="M60 930 L270 1090" stroke={C} strokeWidth="12" strokeLinecap="round"/></>,
({f})=><><Headline a="Ignore Flex" b="Keep Math" frame={f}/><Person x={210} y={830} s={1.0} kind="chad" mood="smirk" pose="cross" frame={f}/><Person x={515} y={830} s={1.0} kind="monk" mood="smile" pose="present" frame={f}/><Handshake frame={f}/></>
];

export const V11ReferenceVisual=({frame})=>{
  const sceneFrames=58;
  const n=Math.min(scenes.length-1,Math.floor(frame/sceneFrames));
  const local=frame-n*sceneFrames;
  const Scene=scenes[n];
  const settle=spring({frame:local,fps:24,config:{damping:18,stiffness:120,mass:.8}});
  return <div style={{position:"absolute",inset:0,background:PAPER,overflow:"hidden"}}>
    <svg width="720" height="1280" viewBox="0 0 720 1280">
      <Paper/>
      <g transform={`translate(0 ${I(settle,0,1,10,0)}) scale(${I(settle,0,1,.985,1)})`} style={{transformOrigin:"360px 640px"}}>
        <Scene f={local}/>
      </g>
    </svg>
  </div>;
};
