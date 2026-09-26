import React from "react";
import {interpolate} from "remotion";

const INK="#151515", PAPER="#fffdf7", CREAM="#eee6d3", BLUE="#7f9bb3", BROWN="#80644e", RED="#c94a45", GREEN="#4f855c", YELLOW="#d6ae55";
const clamp={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const I=(v,a,b,x,y)=>interpolate(v,[a,b],[x,y],clamp);
const E=p=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
const rad=d=>d*Math.PI/180;
const pt=(x,y,l,a)=>[x+Math.cos(rad(a))*l,y+Math.sin(rad(a))*l];

const Hand=({x,y,size=32,children,fill=INK,rotate=0,anchor="middle"})=>
  <text x={x} y={y} textAnchor={anchor} fill={fill} fontFamily="Comic Sans MS,Comic Sans,cursive" fontWeight="700" fontSize={size} transform={rotate?`rotate(${rotate} ${x} ${y})`:undefined}>{children}</text>;

const Limb=({x,y,a1,a2,l1=55,l2=55})=>{
 const e=pt(x,y,l1,a1),h=pt(e[0],e[1],l2,a2);
 return <g><line x1={x} y1={y} x2={e[0]} y2={e[1]}/><line x1={e[0]} y1={e[1]} x2={h[0]} y2={h[1]}/><circle cx={e[0]} cy={e[1]} r="4" fill={PAPER}/></g>;
};
const Person=({x,y,s=1,name,face="flat",lean=0,bob=0,la=[150,125],ra=[30,55],ll=[110,100],rl=[70,80],hat=false})=>{
 const mouth=face==="wow"?"M-10 -58 a10 11 0 1 0 20 0 a10 11 0 1 0 -20 0":face==="smile"?"M-16 -64 Q0 -48 16 -64":face==="mad"?"M-16 -54 Q0 -68 16 -54":"M-12 -57 L12 -57";
 return <g transform={`translate(${x} ${y+bob}) scale(${s}) rotate(${lean})`} stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round">
   <circle cy="-82" r="34" fill={PAPER}/>{hat&&<path d="M-34 -112 L-19 -155 L22 -145 L31 -111 Z M-45 -111 H43" fill={PAPER}/>}
   <circle cx="-11" cy="-91" r="4" fill={INK} stroke="none"/><circle cx="11" cy="-91" r="4" fill={INK} stroke="none"/><path d={mouth}/>
   <line y1="-48" y2="82"/><Limb x={0} y={-5} a1={la[0]} a2={la[1]}/><Limb x={0} y={-5} a1={ra[0]} a2={ra[1]}/>
   <Limb x={0} y={82} a1={ll[0]} a2={ll[1]} l1={58} l2={67}/><Limb x={0} y={82} a1={rl[0]} a2={rl[1]} l1={58} l2={67}/>
   {name&&<Hand x={0} y={-145} size={19}>{name}</Hand>}
 </g>;
};
const Bubble=({x,y,w=360,h=120,children,tail="left"})=><g>
 <rect x={x-w/2} y={y-h/2} width={w} height={h} rx="38" fill={PAPER} stroke={INK} strokeWidth="6"/>
 <path d={tail==="left"?`M${x-w*.18} ${y+h/2-2} l-25 38 l58 -34`:`M${x+w*.18} ${y+h/2-2} l25 38 l-58 -34`} fill={PAPER} stroke={INK} strokeWidth="6"/>
 <Hand x={x} y={y+10} size={28}>{children}</Hand>
</g>;
const Card=({x,y,rot=0})=><g transform={`translate(${x} ${y}) rotate(${rot})`}><rect x="-105" y="-64" width="210" height="128" rx="18" fill={PAPER} stroke={INK} strokeWidth="7"/><rect x="-80" y="-34" width="40" height="26" rx="4" fill={CREAM} stroke={INK} strokeWidth="4"/><Hand x={0} y={35} size={24}>EXAMPLE $695</Hand></g>;

const SceneA=({p})=><>
 <rect width="720" height="1280" fill={PAPER}/>
 <line x1="0" y1="1035" x2="720" y2="1035" stroke={INK} strokeWidth="6"/>
 <g transform={`translate(${I(E(p),0,1,-170,0)} 0)`}><rect x="62" y="485" width="165" height="205" rx="12" fill={CREAM} stroke={INK} strokeWidth="7"/><path d="M62 520 L145 590 L227 520" fill="none" stroke={INK} strokeWidth="6"/><Hand x={145} y={645} size={27} fill={RED}>$695</Hand></g>
 <Person x={485} y={830} s={1.3} name="DAVE" face={p>.4?"wow":"flat"} lean={I(p,.35,1,0,-7)} ra={[I(p,0,1,30,-35),I(p,0,1,55,-70)]}/>
 <Bubble x={430} y={290} w={480}>ANNUAL FEE. AGAIN.</Bubble>
 <Hand x={360} y={1160} size={25} rotate={-1}>mailbox: 1  •  joy: 0</Hand>
</>;

const SceneB=({p})=><>
 <rect width="720" height="1280" fill={PAPER}/>
 <line x1="0" y1="1040" x2="720" y2="1040" stroke={INK} strokeWidth="6"/>
 <Person x={170} y={840} s={1.15} name="DAVE" face="flat" ra={[15,5]}/>
 <Person x={520} y={820} s={1.28} name="CHAD" face="smile" bob={Math.sin(p*Math.PI*2)*8} la={[I(p,0,1,150,205),I(p,0,1,125,220)]} ra={[I(p,0,1,30,-20),I(p,0,1,55,-55)]}/>
 <g transform={`translate(${I(E(p),0,1,780,0)} 0)`}><rect x="245" y="455" width="270" height="165" rx="18" fill={CREAM} stroke={INK} strokeWidth="7"/><Hand x={380} y={515} size={30}>SPEND $80</Hand><Hand x={380} y={575} size={30} fill={GREEN}>GET $20</Hand></g>
 <Bubble x={440} y={265} w={420} tail="right">EASY. IT'S A CREDIT.</Bubble>
</>;

const SceneC=({p})=><>
 <rect width="720" height="1280" fill={PAPER}/>
 <line x1="0" y1="1040" x2="720" y2="1040" stroke={INK} strokeWidth="6"/>
 <Person x={510} y={830} s={1.26} name="POINTS MONK" face="mad" hat la={[I(p,0,1,150,205),I(p,0,1,125,220)]} ra={[I(p,0,1,30,-30),I(p,0,1,55,-60)]}/>
 <Person x={175} y={850} s={1.08} name="DAVE" face="wow" lean={I(p,0,1,0,5)}/>
 <g transform={`translate(${I(E(p),0,1,-260,0)} 0)`}><circle cx="245" cy="480" r="118" fill={CREAM} stroke={INK} strokeWidth="7"/><Hand x={245} y={470} size={32}>CREDIT</Hand><Hand x={245} y={525} size={34} fill={RED}>≠ FREE</Hand><path d="M165 400 L325 560 M325 400 L165 560" stroke={RED} strokeWidth="14" strokeLinecap="round"/></g>
 <Bubble x={410} y={250} w={500} tail="right">WOULD YOU BUY IT ANYWAY?</Bubble>
</>;

const SceneD=({p})=><>
 <rect width="720" height="1280" fill={PAPER}/>
 <g transform={`translate(360 ${I(E(p),0,.35,180,485)})`}><path d="M-168 -165 H168 V178 L136 158 L102 178 L68 158 L34 178 L0 158 L-34 178 L-68 158 L-102 178 L-136 158 L-168 178 Z" fill={CREAM} stroke={INK} strokeWidth="7"/><Hand x={0} y={-78} size={28}>SPEND</Hand><Hand x={0} y={-20} size={48}>$80</Hand><Hand x={0} y={45} size={27} fill={GREEN}>CREDIT −$20</Hand><line x1="-90" y1="72" x2="90" y2="72" stroke={INK} strokeWidth="5"/><Hand x={0} y={138} size={52} fill={RED}>$60</Hand></g>
 <Person x={170} y={970} s={.95} name="DAVE" face="wow" la={[I(p,0,1,150,215),I(p,0,1,125,230)]}/>
 <Person x={550} y={960} s={.95} name="POINTS MONK" face="flat" ra={[I(p,0,1,30,-30),I(p,0,1,55,-55)]}/>
 <Hand x={360} y={1160} size={27} rotate={1}>the receipt does not care about the flex</Hand>
</>;

const SceneE=({p})=><>
 <rect width="720" height="1280" fill={PAPER}/>
 <path d="M360 420 L360 880" stroke={INK} strokeWidth="8"/><path d="M145 530 H575" stroke={INK} strokeWidth="8"/>
 <path d="M155 530 L90 715 H220 Z M565 530 L500 715 H630 Z" fill={CREAM} stroke={INK} strokeWidth="7"/>
 <Hand x={155} y={770} size={27}>VALUE YOU'D</Hand><Hand x={155} y={808} size={27}>BUY ANYWAY</Hand>
 <Hand x={565} y={770} size={28}>FEE YOU</Hand><Hand x={565} y={808} size={28}>ACTUALLY PAY</Hand>
 <circle cx={I(E(p),0,1,120,500)} cy="465" r="28" fill={YELLOW} stroke={INK} strokeWidth="6"/>
 <Person x={360} y={1020} s={.88} name="POINTS MONK" face="flat" la={[150,190]} ra={[30,-10]}/>
 <Bubble x={360} y={235} w={490}>COMPARE REAL VALUE.</Bubble>
</>;

const SceneF=({p})=><>
 <rect width="720" height="1280" fill={PAPER}/>
 <path d="M360 460 V1030" stroke={INK} strokeWidth="7"/>
 <path d="M360 460 Q240 540 125 635" fill="none" stroke={GREEN} strokeWidth="16" strokeLinecap="round"/>
 <path d="M360 460 Q480 540 595 635" fill="none" stroke={RED} strokeWidth="16" strokeLinecap="round"/>
 <Hand x={145} y={375} size={38} fill={GREEN}>VALUE &gt; FEE</Hand><Hand x={575} y={375} size={38} fill={RED}>VALUE &lt; FEE</Hand>
 <Hand x={145} y={710} size={34} fill={GREEN}>KEEP?</Hand><Hand x={575} y={710} size={34} fill={RED}>RETHINK.</Hand>
 <Person x={360} y={905} s={1.12} name="DAVE" face={p>.55?"smile":"flat"} lean={I(p,0,1,-3,3)} la={[I(p,0,1,145,195),I(p,0,1,120,205)]} ra={[I(p,0,1,35,-15),I(p,0,1,60,-35)]}/>
 <Card x={I(E(p),0,1,360,145)} y={870} rot={I(p,0,1,0,-12)}/>
 <Hand x={360} y={1160} size={29}>IGNORE THE FLEX. KEEP THE MATH.</Hand>
</>;

const scenes=[SceneA,SceneB,SceneC,SceneD,SceneE,SceneF];
const cuts=[0,5,10.8,15,20,25,30];

export const V10StoryVisual=({frame})=>{
 const t=frame/24; let i=scenes.length-1;
 for(let n=0;n<cuts.length-1;n++){if(t>=cuts[n]&&t<cuts[n+1]){i=n;break;}}
 const p=Math.max(0,Math.min(1,(t-cuts[i])/(cuts[i+1]-cuts[i])));
 const S=scenes[i]; const z=1+0.012*Math.sin(Math.PI*p);
 return <div style={{position:"absolute",inset:0,background:PAPER,overflow:"hidden"}}><svg width="720" height="1280" viewBox="0 0 720 1280" style={{transform:`scale(${z})`,transformOrigin:"center"}}><S p={p}/></svg></div>;
};
