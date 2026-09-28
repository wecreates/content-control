import React from "react";
import {interpolate,spring} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
const K="#111",W="#fff",R="#ef3e36",Y="#f4c542",T="#11a7a7",G="#dff7ef";
const C={extrapolateLeft:"clamp",extrapolateRight:"clamp"};
const I=(v,a,b,x,y)=>interpolate(v,[a,b],[x,y],C);
const clamp=v=>Math.max(0,Math.min(1,v));
const Text=({x=360,y=100,size=48,color=K,children,rot=0})=><text x={x} y={y} textAnchor="middle" fill={color} fontFamily="Arial Black,Arial,sans-serif" fontWeight="900" fontSize={size} transform={`rotate(${rot} ${x} ${y})`}>{children}</text>;
const Card=({x,y,rot=0,scale=1})=><g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
 <rect x="-120" y="-70" width="240" height="140" rx="20" fill={K}/><rect x="-92" y="-40" width="44" height="30" rx="4" fill={Y}/><Text x={0} y={38} size={31} color={W}>2% BACK</Text>
</g>;
const Price=({x,y,p})=><g transform={`translate(${x} ${y}) rotate(${I(p,0,1,-8,8)})`}><rect x="-130" y="-70" width="260" height="140" rx="24" fill={W} stroke={K} strokeWidth="6"/><Text y={20} size={64}>$80</Text></g>;
const Coin=({x,y,r=22})=><g><circle cx={x} cy={y} r={r} fill={Y} stroke={K} strokeWidth="4"/><Text x={x} y={y+9} size={r*1.1}>¢</Text></g>;
const Door=({p})=><g transform={`translate(${I(p,0,1,760,470)} 610) rotate(${I(p,0,1,0,-24)})`}><rect x="-115" y="-250" width="230" height="500" fill={G} stroke={K} strokeWidth="8"/><circle cx="72" cy="0" r="10" fill={K}/></g>;
const scenes=[
({p})=><><Text y={100} size={55}>DAVE FOUND</Text><Text y={165} size={72} color={T}>2% CASHBACK</Text><Card x={360} y={480} rot={I(p,0,1,-18,18)} scale={I(p,0,1,.7,1.1)}/><Dave x={360} y={900} s={1.35} mood="shock" arm={I(p,0,1,0,28)}/></>,
({p})=><><Text y={115} size={52}>BRAIN STATUS:</Text><Text y={190} size={68} color={R}>CASINO</Text>{[0,1,2,3,4].map(i=><Coin key={i} x={110+i*125} y={380+Math.sin((p+i)*6)*65} r={28}/>)}
<Dave x={360} y={930} s={1.5} mood="smile" lean={Math.sin(p*12)*8}/><Text y={1180} size={34}>JACKPOT NOISES INTERNALLY</Text></>,
({p})=><><Text y={120} size={58}>ONE SMALL PROBLEM</Text><Price x={360} y={430} p={p}/><Dave x={220} y={900} s={1.3} mood="shock"/><Text x={500} y={760} size={40} color={R}>DOESN'T NEED IT</Text><path d="M470 790 L560 900" stroke={R} strokeWidth="14"/></>,
({p})=><><Text y={120} size={55}>DAVE:</Text><Text y={200} size={58} color={T}>“BUT I GET MONEY BACK.”</Text><Dave x={360} y={830} s={1.7} mood="smile" arm={-25}/><Card x={520} y={470} rot={I(p,0,1,-10,10)} scale={0.85}/></>,
({p})=><><Text y={120} size={60}>CORRECT.</Text><Text y={370} size={130} color={Y}>$1.60</Text><Text y={470} size={38}>BACK ON AN $80 BUY</Text><Text y={650} size={34} color={R}>THIS IS NOT A HEIST</Text><Dave x={360} y={930} s={1.2} mood="shock"/></>,
({p})=><><Text y={115} size={54}>CONGRATULATIONS.</Text><Text y={190} size={42}>YOU SPENT $80 TO SUMMON...</Text><g transform={`translate(360 620) scale(${I(p,0,1,.6,1.15)}) rotate(${I(p,0,1,-15,5)})`}><rect x="-150" y="-150" width="300" height="300" rx="45" fill={Y} stroke={K} strokeWidth="8"/><circle cx="-55" cy="-30" r="14" fill={K}/><circle cx="55" cy="-30" r="14" fill={K}/><path d="M-70 70 Q0 15 70 70" fill="none" stroke={K} strokeWidth="10"/></g><Text y={1050} size={48} color={R}>A SAD GADGET</Text></>,
({p})=><><Text y={115} size={56}>THEN—</Text><Door p={p}/><PointsMonk x={I(p,0,1,820,470)} y={880} s={1.45} lean={-12} mood="mad" arm={35}/><Text x={250} y={300} size={48} color={R}>KICK.</Text><Text x={250} y={360} size={48} color={R}>THE.</Text><Text x={250} y={420} size={48} color={R}>DOOR.</Text></>,
({p})=><><Text y={100} size={48}>POINTS MONK:</Text><Text y={180} size={58}>“WOULD YOU BUY IT</Text><Text y={250} size={58} color={R}>WITHOUT THE REWARD?”</Text><PointsMonk x={360} y={870} s={1.55} mood="mad" arm={I(p,0,1,-15,25)}/></>,
({p})=><><Text y={110} size={62}>IF NO...</Text><Text y={250} size={78} color={R}>THE REWARD WON.</Text><Dave x={180} y={880} s={1.3} mood="shock"/><Card x={500} y={510} rot={I(p,0,1,0,360)} scale={1}/><path d="M500 650 C600 760 560 920 430 970" fill="none" stroke={R} strokeWidth="10" strokeDasharray="14 12"/></>,
({p})=><><Text y={105} size={54}>BANK MATH</Text><Text x={220} y={350} size={60} color={R}>YOU:</Text><Text x={500} y={350} size={60} color={T}>BANK:</Text><Text x={220} y={500} size={82}>-$80</Text><Text x={500} y={500} size={82}>+$78.40</Text><Text y={690} size={50} color={R}>“FREE MONEY”</Text><Text y={760} size={32}>was doing cardio in the opposite direction</Text></>,
({p})=><><Text y={110} size={54}>THE ACTUAL RULE</Text><Text y={320} size={66} color={T}>BUY FIRST.</Text><Text y={410} size={66} color={Y}>REWARD SECOND.</Text><PointsMonk x={360} y={860} s={1.5} mood="smile"/><Text y={1130} size={34}>REWARDS SHOULD FOLLOW THE PURCHASE.</Text></>,
({p})=><><Text y={115} size={58}>NOT LEAD IT.</Text><Dave x={230} y={850} s={1.2} mood="shock" arm={I(p,0,1,0,22)}/><PointsMonk x={500} y={850} s={1.2} mood="deadpan" arm={I(p,0,1,0,30)}/><CashbackGoblin x={I(p,0,1,650,330)} y={980} s={.72} lean={I(p,0,1,18,-18)} mood="smile" arm={32} leg={16}/><Coin x={360} y={500} r={52}/><path d={`M330 955 Q${I(p,0,1,500,430)} 980 475 905`} fill="none" stroke={K} strokeWidth="7"/><Text y={1120} size={38} color={T}>BUY FIRST. REWARD SECOND.</Text></>
];
const cuts=[0,2.1,4.3,6.6,8.7,11.1,13.6,16.0,18.6,21.0,23.7,26.3,30];
export const CashbackCasinoVisual=({frame})=>{
 const t=frame/24; let n=cuts.length-2; for(let i=0;i<cuts.length-1;i++){if(t>=cuts[i]&&t<cuts[i+1]){n=i;break;}}
 const p=clamp((t-cuts[n])/(cuts[n+1]-cuts[n])); const S=scenes[n];
 const punch=1+0.045*Math.sin(Math.PI*p); const xshake=(n===6?Math.sin(frame*1.7)*8:Math.sin(frame*.55+n)*2);
 return <div style={{position:"absolute",inset:0,background:W,overflow:"hidden"}}><svg width="720" height="1280" viewBox="0 0 720 1280" style={{transform:`translateX(${xshake}px) scale(${punch})`,transformOrigin:"center"}}><S p={p}/></svg></div>
};