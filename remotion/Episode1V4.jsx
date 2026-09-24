import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const C={bg:"#0b1018",panel:"#151c28",line:"#f5f7fa",muted:"#8d96a6",green:"#39ff14",red:"#ff4a4a",yellow:"#ffdc50",blue:"#62b5ff"};
const clamp={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const I=(v,a,b,c,d)=>interpolate(v,[a,b],[c,d],clamp);
const show=(t,a,b)=>interpolate(t,[a,a+.15,b-.18,b],[0,1,1,0],clamp);
const pop=(frame,fps,start=0)=>spring({frame:frame-start*fps,fps,config:{damping:11,stiffness:190,mass:.7}});
const wiggle=(t,s=1)=>Math.sin(t*8)*s;

const Txt=({children,x=640,y=80,size=54,color=C.line,opacity=1,rotate=0,align="center"})=>(
  <text x={x} y={y} fill={color} opacity={opacity} fontFamily="Arial, Helvetica, sans-serif" fontSize={size} fontWeight="900"
    textAnchor={align==="center"?"middle":align==="left"?"start":"end"}
    transform={`rotate(${rotate} ${x} ${y})`}
    style={{paintOrder:"stroke",stroke:C.bg,strokeWidth:8,strokeLinejoin:"round"}}>{children}</text>
);

const Stick=({x,y,scale=1,pose=0,face="neutral",color=C.line,look=1,opacity=1,hat=false})=>{
  const arm=Math.sin(pose)*30;
  const leg=Math.sin(pose*.8)*20;
  const mouth=face==="panic"?"M -11 -54 Q 0 -67 11 -54":face==="smile"?"M -12 -61 Q 0 -46 12 -61":face==="angry"?"M -11 -50 Q 0 -44 11 -50":"M -9 -57 L 9 -57";
  return <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round">
    <circle cx="0" cy="-70" r="25"/><line x1="0" y1="-45" x2="0" y2="72"/>
    <line x1="0" y1="-13" x2={-56-arm} y2={25+arm*.35}/><line x1="0" y1="-13" x2={56+arm} y2={-4-arm*.25}/>
    <line x1="0" y1="72" x2={-43-leg} y2="145"/><line x1="0" y1="72" x2={43+leg} y2="145"/>
    <circle cx={-9+look*1.8} cy="-76" r="2.8" fill={color} stroke="none"/><circle cx={9+look*1.8} cy="-76" r="2.8" fill={color} stroke="none"/>
    <path d={mouth}/>
    {hat&&<><path d="M-26 -96 Q0 -125 26 -96"/><line x1="-34" y1="-95" x2="34" y2="-95"/></>}
  </g>;
};

const Card=({x,y,scale=1,label="PREMIUM",color=C.line,rotate=0,opacity=1})=>(
  <g transform={`translate(${x} ${y}) scale(${scale}) rotate(${rotate})`} opacity={opacity}>
    <rect x="-145" y="-78" width="290" height="156" rx="22" fill="#202938" stroke={color} strokeWidth="7"/>
    <rect x="-118" y="-48" width="54" height="36" rx="6" fill={C.yellow}/>
    <text x="-118" y="40" fill={color} fontSize="27" fontWeight="900">{label}</text>
    <circle cx="102" cy="-38" r="12" fill={C.green}/>
  </g>
);

const Coin=({x,y,r=26,label="$",color=C.green,opacity=1,scale=1})=>(
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    <circle r={r} fill="#102516" stroke={color} strokeWidth="5"/>
    <text y="10" textAnchor="middle" fill={color} fontSize={r*1.05} fontWeight="900">{label}</text>
  </g>
);

const Impact=({t,start,end,text,color=C.line,size=40,y=650})=>{
  const o=show(t,start,end);
  const s=.85+.15*interpolate(o,[0,1],[0,1],clamp);
  return <div style={{position:"absolute",left:60,right:60,top:y-48,textAlign:"center",opacity:o,transform:`scale(${s})`,fontFamily:"Arial",fontWeight:1000,fontSize:size,color,textShadow:"0 6px 24px #000",letterSpacing:.5}}>{text}</div>;
};

const SpeedLines=({opacity=.2})=><svg width="1280" height="720" style={{position:"absolute",inset:0,opacity}}>
  {Array.from({length:18}).map((_,i)=><line key={i} x1={50+i*70} y1={720} x2={220+i*70} y2={0} stroke="#26344c" strokeWidth="3"/>)}
</svg>;

export const ColdOpenFeeCrash=({t,frame,fps})=>{
  const local=t;
  const feeY=I(local,3.2,5.1,-180,335);
  const squash=local>5?I(local,5,5.35,1,.78):1;
  const cardX=I(local,0,3,450,520);
  const title=show(local,8.4,14.8);
  return <AbsoluteFill style={{backgroundColor:C.bg}}>
    <SpeedLines opacity={.12}/>
    <svg width="1280" height="720">
      <line x1="0" y1="565" x2="1280" y2="565" stroke="#253149" strokeWidth="4"/>
      <Card x={cardX} y={310} rotate={-8+wiggle(local,2)} color={C.line}/>
      <Stick x={350} y={405} scale={squash} pose={local*5} face={local>5?"panic":"smile"}/>
      <g transform={`translate(780 ${feeY}) rotate(${wiggle(local,5)})`}>
        <rect x="-190" y="-72" width="380" height="144" rx="16" fill="#f2eee4" stroke={C.red} strokeWidth="8"/>
        <text x="0" y="-3" textAnchor="middle" fontSize="48" fontWeight="1000" fill="#151515">$200 ANNUAL FEE</text>
        <text x="0" y="42" textAnchor="middle" fontSize="21" fontWeight="900" fill="#555">CONGRATS ON ADULTHOOD</text>
      </g>
      {local>6&&<g opacity={show(local,6,11)}>
        <Stick x={1000} y={420} scale={.83} pose={-local*4} face="neutral" hat/>
        <Txt x={1000} y={240} size={31} color={C.yellow}>BANK REP</Txt>
      </g>}
    </svg>
    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:title,transform:`scale(${.82+.18*pop(frame,fps,8.4)})`}}>
      <div style={{fontFamily:"Arial",fontWeight:1000,fontSize:74,lineHeight:.93,textAlign:"center",color:C.line,textShadow:"0 8px 34px #000"}}>
        YOUR CREDIT CARD<br/><span style={{color:C.yellow}}>HAS DLC</span>
      </div>
    </div>
    <Impact t={local} start={.2} end={3.2} text="Alex unlocked adulthood." size={33}/>
    <Impact t={local} start={5.15} end={8.2} text="THE FEE UNLOCKED HIM." color={C.red} size={43}/>
    <Impact t={local} start={15.2} end={21.5} text="Rewards. Interest. Bonuses. One tiny 0% asterisk." size={30}/>
  </AbsoluteFill>;
};

export const RewardsArcade=({t})=>{
  const local=t-22;
  const alexX=I(local,0,36,170,1080);
  const coins=Array.from({length:13}).map((_,i)=>{
    const x=220+(i%7)*125;
    const y=180+Math.floor(i/7)*145+Math.sin(local*3+i)*12;
    const hit=Math.max(0,Math.min(1,I(local,i*1.2, i*1.2+.6,0,1)));
    return <Coin key={i} x={x} y={y} scale={.55+.45*hit} opacity={show(local,0,36)}/>;
  });
  const meter=I(local,20,34,0,210);
  return <AbsoluteFill style={{background:"radial-gradient(circle at 50% 45%, #15253a 0%, #0b1018 62%)"}}>
    <svg width="1280" height="720">
      <rect x="45" y="55" width="1190" height="575" rx="35" fill="none" stroke="#26364f" strokeWidth="5"/>
      <Txt x={640} y={105} size={39} color={C.yellow}>REWARDS ARCADE</Txt>
      {coins}
      <Stick x={alexX} y={445} pose={local*9} face={local>31?"smile":"neutral"} scale={.9}/>
      <g transform="translate(1010 190)">
        <rect x="-145" y="-65" width="290" height="130" rx="20" fill={C.panel} stroke={C.green} strokeWidth="6"/>
        <text x="0" y="-8" textAnchor="middle" fill={C.green} fontSize="48" fontWeight="1000">30,000</text>
        <text x="0" y="38" textAnchor="middle" fill={C.line} fontSize="22" fontWeight="900">POINTS</text>
      </g>
      <g transform="translate(1010 355)">
        <rect x="-150" y="-60" width="300" height="120" rx="18" fill="#111820" stroke={C.muted} strokeWidth="5"/>
        <rect x="-132" y="-18" width={264*Math.min(1,meter/210)} height="34" rx="17" fill={C.green}/>
        <text x="0" y="-28" textAnchor="middle" fill={C.line} fontSize="21" fontWeight="900">REAL VALUE</text>
        <text x="0" y="52" textAnchor="middle" fill={C.yellow} fontSize="26" fontWeight="1000">${Math.round(meter)}</text>
      </g>
      {local>30&&<g transform="translate(640 305)">
        <line x1="-80" y1="-70" x2="80" y2="70" stroke={C.red} strokeWidth="11"/>
        <line x1="-80" y1="70" x2="80" y2="-70" stroke={C.red} strokeWidth="11"/>
        <text x="0" y="145" textAnchor="middle" fill={C.red} fontSize="28" fontWeight="1000">NOT FREE MONEY</text>
      </g>}
    </svg>
    <Impact t={local} start={1} end={8} text="Spend you already planned." color={C.green}/>
    <Impact t={local} start={18} end={27} text="Points are worth what you can actually redeem." size={31}/>
    <Impact t={local} start={32} end={37.5} text="30,000 → about $210 in this example." color={C.yellow} size={34}/>
  </AbsoluteFill>;
};

export const CreditCardChase=({t})=>{
  const local=t-60;
  const cardX=I(local,0,39,1250,320);
  const alexX=I(local,0,39,1060,130);
  const chaseBounce=Math.sin(local*11)*10;
  const receiptX=I(local,11,18,1280,680);
  return <AbsoluteFill style={{backgroundColor:"#091019"}}>
    <SpeedLines opacity={.32}/>
    <svg width="1280" height="720">
      <line x1="0" y1="570" x2="1280" y2="570" stroke="#26364f" strokeWidth="4"/>
      <Stick x={alexX} y={420+chaseBounce} pose={local*12} face="panic"/>
      <g transform={`translate(${cardX} ${355-chaseBounce*.7})`}>
        <rect x="-100" y="-155" width="200" height="310" rx="28" fill="#111923" stroke={C.green} strokeWidth="8"/>
        <circle cx="-38" cy="18" r="9" fill={C.line}/><circle cx="38" cy="18" r="9" fill={C.line}/>
        <path d="M-45 62 Q0 95 45 62" fill="none" stroke={C.line} strokeWidth="6"/>
        <text x="0" y="-58" textAnchor="middle" fill={C.green} fontSize="31" fontWeight="1000">USE ME</text>
        <line x1="-95" y1="90" x2="-142" y2="132" stroke={C.line} strokeWidth="7"/>
        <line x1="95" y1="90" x2="142" y2="132" stroke={C.line} strokeWidth="7"/>
      </g>
      <g transform={`translate(${receiptX} 250) rotate(-8)`} opacity={show(local,10,28)}>
        <rect x="-155" y="-90" width="310" height="180" rx="12" fill="#eee8db" stroke={C.red} strokeWidth="6"/>
        <text x="0" y="-34" textAnchor="middle" fill="#222" fontSize="25" fontWeight="900">THINGS ALEX DIDN'T NEED</text>
        <text x="0" y="8" textAnchor="middle" fill="#222" fontSize="22">+$47  +$80  +$29</text>
        <text x="0" y="54" textAnchor="middle" fill={C.red} fontSize="30" fontWeight="1000">"FOR THE POINTS"</text>
      </g>
      {local>29&&<g transform="translate(740 360)">
        <circle r="118" fill="#151c28" stroke={C.yellow} strokeWidth="8"/>
        <text y="-18" textAnchor="middle" fill={C.yellow} fontSize="31" fontWeight="1000">SAVED</text>
        <text y="38" textAnchor="middle" fill={C.red} fontSize="47" fontWeight="1000">-$5</text>
      </g>}
    </svg>
    <Impact t={local} start={0} end={8} text='"Use your card for everything!"' color={C.green} size={39}/>
    <Impact t={local} start={12} end={21} text="Rewards stop working when they create spending." color={C.red} size={32}/>
    <Impact t={local} start={30} end={38.5} text="Congratulations. You optimized backwards." color={C.yellow} size={36}/>
  </AbsoluteFill>;
};

export const CardGameShow=({t})=>{
  const local=t-99;
  const premium=I(local,5,26,0,70);
  const free=I(local,5,26,0,200);
  const buzz=local>27&&local<31?wiggle(local,8):0;
  return <AbsoluteFill style={{background:"linear-gradient(180deg,#12182a,#090d15)"}}>
    <svg width="1280" height="720">
      <Txt x={640} y={92} size={42} color={C.yellow}>SAME SPENDING. WHICH CARD WINS?</Txt>
      <Stick x={155} y={430} scale={.85} pose={local*3} face="neutral" hat/>
      <Txt x={155} y={240} size={25} color={C.yellow}>HOST</Txt>
      <g transform={`translate(${440+buzz} 340)`}>
        <Card x={0} y={0} label="PREMIUM" color={C.red}/>
        <text x="0" y="150" textAnchor="middle" fill={C.red} fontSize="56" fontWeight="1000">${Math.round(premium)}</text>
      </g>
      <g transform="translate(860 340)">
        <Card x={0} y={0} label="FREE" color={C.green}/>
        <text x="0" y="150" textAnchor="middle" fill={C.green} fontSize="56" fontWeight="1000">${Math.round(free)}</text>
      </g>
      <line x1="650" y1="195" x2="650" y2="535" stroke="#303a50" strokeWidth="5"/>
      {local>25&&<g opacity={show(local,25,34)}>
        <Txt x={650} y={615} size={36} color={C.green}>FREE CARD: +$130 IN THIS EXAMPLE</Txt>
      </g>}
    </svg>
    <Impact t={local} start={1} end={7} text="No extra spending. Same purchases." size={31}/>
    <Impact t={local} start={26} end={33} text="Shiny metal did not win the math." color={C.yellow} size={33}/>
  </AbsoluteFill>;
};

const Monster=({x,y,scale=1,open=0})=><g transform={`translate(${x} ${y}) scale(${scale})`}>
  <path d="M-125 110 Q-150 -40 -100 -140 Q0 -190 100 -140 Q150 -40 125 110Z" fill="#23090d" stroke={C.red} strokeWidth="9"/>
  <circle cx="-42" cy="-60" r="12" fill={C.red}/><circle cx="42" cy="-60" r="12" fill={C.red}/>
  <path d={open>0?"M-65 20 Q0 100 65 20":"M-58 28 Q0 62 58 28"} fill="none" stroke={C.red} strokeWidth="8"/>
  <text x="0" y="-112" textAnchor="middle" fill={C.red} fontSize="38" fontWeight="1000">APR</text>
</g>;

export const InterestBossBattle=({t})=>{
  const local=t-133;
  const size=1+I(local,8,43,0,.72);
  const trophyX=I(local,0,22,310,820);
  const trophyY=I(local,0,22,290,390);
  const beam=local>27?I(local,27,36,0,1):0;
  return <AbsoluteFill style={{background:"radial-gradient(circle at 70% 50%,#26090e 0%,#0b1018 46%)"}}>
    <svg width="1280" height="720">
      <Stick x={250} y={430} pose={local*6} face={local>20?"panic":"smile"}/>
      <g transform={`translate(${trophyX} ${trophyY})`} opacity={show(local,0,30)}>
        <path d="M-62 -75 L62 -75 L42 20 Q0 62 -42 20Z" fill="#102716" stroke={C.green} strokeWidth="7"/>
        <rect x="-18" y="20" width="36" height="60" fill="none" stroke={C.green} strokeWidth="7"/>
        <text x="0" y="-10" textAnchor="middle" fill={C.green} fontSize="32" fontWeight="1000">$20</text>
      </g>
      <Monster x={900} y={400} scale={size} open={local>18?1:0}/>
      {local>27&&<g opacity={beam}>
        <line x1="820" y1="340" x2="375" y2="345" stroke={C.red} strokeWidth="20" opacity={.35}/>
        {Array.from({length:7}).map((_,i)=><text key={i} x={760-i*64} y={320+Math.sin(local*7+i)*25} fill={C.red} fontSize="28" fontWeight="1000">$</text>)}
      </g>}
      {local>37&&<g transform="translate(285 325)">
        <circle r={72} fill="#111820" stroke={C.red} strokeWidth="7"/>
        <text y="-8" textAnchor="middle" fill={C.red} fontSize="28" fontWeight="1000">BALANCE</text>
        <text y="34" textAnchor="middle" fill={C.red} fontSize="35" fontWeight="1000">GROWS</text>
      </g>}
    </svg>
    <Impact t={local} start={0} end={7} text="Then Alex carries a balance." color={C.red} size={36}/>
    <Impact t={local} start={13} end={22} text="Interest does not care about your rewards trophy." size={32}/>
    <Impact t={local} start={28} end={40} text="The boss fight is the balance, not the points." color={C.red} size={34}/>
    <Impact t={local} start={41} end={47.5} text="Rewards: defeated by financing." color={C.yellow} size={36}/>
  </AbsoluteFill>;
};

export const BonusHeist=({t})=>{
  const local=t-181;
  const cartX=I(local,0,50,160,1040);
  const ladder=local>24?I(local,24,29,0,1):0;
  const boxes=[
    ["GROCERIES",C.green],["GAS",C.green],["DINNER",C.green],["NEW TV?",C.red],["RANDOM STUFF",C.red]
  ];
  return <AbsoluteFill style={{backgroundColor:"#0b1018"}}>
    <svg width="1280" height="720">
      <Txt x={640} y={92} size={41} color={C.yellow}>THE $300 BONUS HEIST</Txt>
      <Stick x={145} y={435} scale={.85} pose={local*4} face={local>29?"panic":"neutral"}/>
      <g transform={`translate(${cartX} 430)`}>
        <rect x="-170" y="-5" width="340" height="105" rx="16" fill="none" stroke={C.line} strokeWidth="7"/>
        <circle cx="-110" cy="130" r="25" fill="none" stroke={C.line} strokeWidth="7"/><circle cx="110" cy="130" r="25" fill="none" stroke={C.line} strokeWidth="7"/>
        {boxes.map(([label,color],i)=>{
          const x=-145+i*70, y=-50-(i%2)*55;
          const o=show(local,3+i*4,47);
          return <g key={label} opacity={o}>
            <rect x={x} y={y} width="88" height="65" rx="8" fill="#1a2230" stroke={color} strokeWidth="4"/>
            <text x={x+44} y={y+38} textAnchor="middle" fill={color} fontSize="12" fontWeight="900">{label}</text>
          </g>
        })}
        {ladder>0&&<g transform={`translate(130 -170) scale(${ladder}) rotate(10)`}>
          <line x1="-30" y1="-100" x2="-30" y2="130" stroke={C.yellow} strokeWidth="7"/><line x1="30" y1="-100" x2="30" y2="130" stroke={C.yellow} strokeWidth="7"/>
          {[-70,-25,20,65,110].map(y=><line key={y} x1="-30" y1={y} x2="30" y2={y} stroke={C.yellow} strokeWidth="6"/>)}
        </g>}
      </g>
      <g transform="translate(1040 175)" opacity={show(local,0,47)}>
        <circle r="105" fill="#142317" stroke={C.green} strokeWidth="8"/>
        <text y="-6" textAnchor="middle" fill={C.green} fontSize="45" fontWeight="1000">$300</text>
        <text y="38" textAnchor="middle" fill={C.line} fontSize="22" fontWeight="900">BONUS</text>
      </g>
      {local>31&&<g transform="translate(650 560)">
        <text x="0" y="0" textAnchor="middle" fill={C.red} fontSize="52" fontWeight="1000">WINNING BACKWARDS</text>
      </g>}
    </svg>
    <Impact t={local} start={1} end={10} text="Great bonus... if the spending was already happening." color={C.green} size={31}/>
    <Impact t={local} start={23} end={31} text="Do not build a ladder to reach a bonus." color={C.yellow} size={34}/>
    <Impact t={local} start={34} end={49.5} text="A $300 bonus does not excuse $700 of invented spending." color={C.red} size={31}/>
  </AbsoluteFill>;
};

export const ZeroAprGameShow=({t})=>{
  const local=t-232;
  const doorOpen=I(local,19,27,0,1);
  const trap=I(local,27,36,0,1);
  const hostFace=local>26?"panic":"neutral";
  return <AbsoluteFill style={{background:"linear-gradient(180deg,#0d1420,#080b11)"}}>
    <svg width="1280" height="720">
      <Txt x={640} y={92} size={41} color={C.yellow}>0% APR: PICK A DOOR</Txt>
      <Stick x={165} y={435} scale={.85} pose={local*3} face={hostFace} hat/>
      <Txt x={165} y={245} size={24} color={C.yellow}>HOST</Txt>
      <g transform="translate(520 360)">
        <rect x="-125" y="-190" width="250" height="380" rx="14" fill="#101923" stroke={C.green} strokeWidth="8"/>
        <text x="0" y="-45" textAnchor="middle" fill={C.green} fontSize="72" fontWeight="1000">0%</text>
        <text x="0" y="15" textAnchor="middle" fill={C.line} fontSize="23" fontWeight="900">INTRO APR</text>
        <text x="0" y="72" textAnchor="middle" fill={C.muted} fontSize="17" fontWeight="700">READ THE CONDITION</text>
      </g>
      <g transform={`translate(865 360) scaleX(${1-doorOpen*.74})`}>
        <rect x="-125" y="-190" width="250" height="380" rx="14" fill="#101923" stroke={C.red} strokeWidth="8"/>
        <text x="0" y="-45" textAnchor="middle" fill={C.red} fontSize="72" fontWeight="1000">0%*</text>
        <text x="0" y="15" textAnchor="middle" fill={C.line} fontSize="22" fontWeight="900">IF PAID IN FULL</text>
        <text x="0" y="72" textAnchor="middle" fill={C.muted} fontSize="17" fontWeight="700">BEFORE DEADLINE</text>
      </g>
      {trap>.05&&<g opacity={trap}>
        <polygon points={`720,550 1080,550 ${1030+trap*80},${550+trap*150} ${770-trap*80},${550+trap*150}`} fill="#2a090d" stroke={C.red} strokeWidth="7"/>
        {Array.from({length:9}).map((_,i)=><text key={i} x={785+(i%5)*58} y={590+Math.floor(i/5)*55+Math.sin(local*5+i)*12} fill={C.red} fontSize="34" fontWeight="1000">$</text>)}
      </g>}
    </svg>
    <Impact t={local} start={1} end={9} text='"Zero percent" is not the whole sentence.' color={C.green} size={34}/>
    <Impact t={local} start={12} end={21} text="Same zero. Different condition." color={C.yellow} size={38}/>
    <Impact t={local} start={28} end={42} text="Miss the deadline and deferred interest can open underneath you." color={C.red} size={31}/>
    <Impact t={local} start={43} end={48.5} text="Read the condition, not the giant number." size={34}/>
  </AbsoluteFill>;
};

export const FinaleCallback=({t})=>{
  const local=t-281;
  const tools=[
    {x:320,label:"USE IT",color:C.green},
    {x:510,label:"DON'T FINANCE",color:C.red},
    {x:720,label:"DON'T INVENT",color:C.yellow},
    {x:930,label:"READ IT",color:C.blue},
  ];
  const monsterY=I(local,20,34,780,510);
  return <AbsoluteFill style={{background:"radial-gradient(circle at 50% 30%,#172338,#0b1018 60%)"}}>
    <svg width="1280" height="720">
      <Txt x={640} y={90} size={46} color={C.line}>ALEX'S FOUR-RULE TOOLKIT</Txt>
      <Stick x={150} y={450} pose={local*4} face={local<19?"smile":"panic"}/>
      {tools.map((o,i)=>{
        const y=245+(i%2)*150;
        const s=Math.max(0,Math.min(1,I(local,2+i*3,3+i*3,0,1)));
        return <g key={o.label} transform={`translate(${o.x} ${y}) scale(${s})`}>
          <rect x="-95" y="-55" width="190" height="110" rx="22" fill="#151c28" stroke={o.color} strokeWidth="7"/>
          <text x="0" y="10" textAnchor="middle" fill={o.color} fontSize={21} fontWeight="1000">{o.label}</text>
        </g>
      })}
      <g transform={`translate(1090 ${monsterY})`}>
        <rect x="-105" y="-165" width="210" height="330" rx="18" fill="#090c11" stroke={C.red} strokeWidth="7"/>
        <circle cx="-42" cy="-38" r="10" fill={C.red}/><circle cx="42" cy="-38" r="10" fill={C.red}/>
        <rect x="-65" y="55" width="130" height="64" rx="18" fill="none" stroke={C.line} strokeWidth="5"/>
        <text x="0" y="96" textAnchor="middle" fill={C.line} fontSize="25" fontWeight="1000">MIN</text>
        <text x="0" y="-105" textAnchor="middle" fill={C.red} fontSize="24" fontWeight="1000">PAYMENT</text>
      </g>
      {local>22&&<g transform="translate(650 580)">
        <text x="0" y="0" textAnchor="middle" fill={C.red} fontSize="42" fontWeight="1000">NEXT BOSS: MINIMUM PAYMENT</text>
      </g>}
    </svg>
    <Impact t={local} start={0} end={10} text="Use rewards. Don't finance them." color={C.green} size={34}/>
    <Impact t={local} start={10} end={19} text="Don't invent spending. Read the condition." color={C.yellow} size={33}/>
    <Impact t={local} start={20} end={29} text="Financial education complete." color={C.green} size={38}/>
    <Impact t={local} start={29} end={34.8} text="...until the minimum payment walks in." color={C.red} size={37}/>
  </AbsoluteFill>;
};

const Section=({t,start,end,children})=>{
  if(t<start||t>=end) return null;
  return children;
};

export const Episode1V4=({audioDuration=306})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const raw=frame/fps;
  const t=raw*(316/Math.max(1,audioDuration));
  return <AbsoluteFill style={{backgroundColor:C.bg,overflow:"hidden"}}>
    <Audio src={staticFile("episode1-rebuild-voice.mp3")} volume={1}/>
    <Section t={t} start={0} end={22}><ColdOpenFeeCrash t={t} frame={frame} fps={fps}/></Section>
    <Section t={t} start={22} end={60}><RewardsArcade t={t}/></Section>
    <Section t={t} start={60} end={99}><CreditCardChase t={t}/></Section>
    <Section t={t} start={99} end={133}><CardGameShow t={t}/></Section>
    <Section t={t} start={133} end={181}><InterestBossBattle t={t}/></Section>
    <Section t={t} start={181} end={232}><BonusHeist t={t}/></Section>
    <Section t={t} start={232} end={281}><ZeroAprGameShow t={t}/></Section>
    <Section t={t} start={281} end={316}><FinaleCallback t={t}/></Section>
    <div style={{position:"absolute",left:18,bottom:12,fontFamily:"Arial",fontSize:13,fontWeight:900,color:"#526078",letterSpacing:1.1}}>
      EPISODE 1 • V4 ENTERTAINMENT BUILD • PUBLICATION DISABLED
    </div>
  </AbsoluteFill>;
};
