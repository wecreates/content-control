import React from "react";
import {AbsoluteFill,Audio,Sequence,staticFile,useCurrentFrame} from "remotion";

const K="#111111", W="#f7f1e6", G="#12a8b4", R="#e53935", Y="#d7a51c";
const I=(p,a,b,x,y)=>x+(y-x)*Math.max(0,Math.min(1,(p-a)/(b-a)));
const E=x=>1-Math.pow(1-x,3);

const T=({children,x=360,y=150,size=60,color=K,anchor="middle"})=>
  <text x={x} y={y} textAnchor={anchor} fontFamily="Trebuchet MS,DejaVu Sans,sans-serif" fontWeight="900" fontSize={size} fill={color}>{children}</text>;

const Stick=({x=360,y=800,s=1,label="DAVE",face="flat",lean=0,arm=0})=><g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`}>
  <circle cx="0" cy="-155" r="58" fill={W} stroke={K} strokeWidth="6"/>
  {face==="smile" && <path d="M-23 -145 Q0 -124 23 -145" fill="none" stroke={K} strokeWidth="5" strokeLinecap="round"/>}
  {face==="wow" && <circle cx="0" cy="-138" r="9" fill="none" stroke={K} strokeWidth="4"/>}
  {face==="flat" && <line x1="-20" y1="-138" x2="20" y2="-138" stroke={K} strokeWidth="4" strokeLinecap="round"/>}
  <circle cx="-18" cy="-165" r="4" fill={K}/><circle cx="18" cy="-165" r="4" fill={K}/>
  <line x1="0" y1="-95" x2="0" y2="105" stroke={K} strokeWidth="7" strokeLinecap="round"/>
  <line x1="0" y1="-30" x2={-105-arm} y2="20" stroke={K} strokeWidth="7" strokeLinecap="round"/>
  <line x1="0" y1="-30" x2={105+arm} y2="20" stroke={K} strokeWidth="7" strokeLinecap="round"/>
  <line x1="0" y1="105" x2="-78" y2="225" stroke={K} strokeWidth="7" strokeLinecap="round"/>
  <line x1="0" y1="105" x2="78" y2="225" stroke={K} strokeWidth="7" strokeLinecap="round"/>
  <T x={0} y={278} size={25}>{label}</T>
</g>;

const Card=({x=360,y=580,rot=0,scale=1})=><g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
  <rect x="-145" y="-88" width="290" height="176" rx="20" fill={K}/>
  <circle cx="-92" cy="-32" r="16" fill={Y}/>
  <rect x="-110" y="32" width="150" height="14" rx="7" fill={W} opacity=".85"/>
  <rect x="-110" y="58" width="92" height="10" rx="5" fill={W} opacity=".6"/>
</g>;

const Coupon=({x,y,label,value,color=G,rot=0})=><g transform={`translate(${x} ${y}) rotate(${rot})`}>
  <rect x="-125" y="-70" width="250" height="140" rx="18" fill={W} stroke={K} strokeWidth="5"/>
  <T x={0} y={-8} size={29}>{label}</T>
  <T x={0} y={42} size={38} color={color}>{value}</T>
</g>;

const scenes=[
({p})=><><T size={74}>Not a flex.</T><Card y={500} rot={I(E(p),0,1,-25,5)} scale={I(E(p),0,1,.65,1.2)}/><Stick x={360} y={940} s={1.05} face="flat" label="DAVE"/></>,
({p})=><><T size={66}>It’s a coupon book.</T><Card x={210} y={540} rot={-10}/><g transform={`translate(${I(E(p),0,1,520,455)} 0)`}><Coupon x={0} y={420} label="CREDIT" value="$??"/><Coupon x={30} y={590} label="CREDIT" value="$??" rot={6}/><Coupon x={-10} y={760} label="CREDIT" value="$??" rot={-5}/></g></>,
({p})=><><T>Hotel credit.</T><Coupon x={360} y={500} label="HOTEL" value="$300" color={G}/><Stick x={360} y={930} s={1.05} face="wow" label="DAVE"/></>,
({p})=><><T>Dining credit.</T><Coupon x={360} y={500} label="DINING" value="$200" color={Y}/><Stick x={360} y={930} s={1.05} face="flat" label="DAVE"/></>,
({p})=><><T>Streaming credit.</T><Coupon x={360} y={500} label="STREAMING" value="$120" color={G}/><Stick x={360} y={930} s={1.05} face="wow" label="DAVE"/></>,
({p})=><><T>Points everywhere.</T>{[0,1,2,3,4,5].map(i=><circle key={i} cx={120+i*95} cy={440+Math.sin(i)*85} r={30+8*(i%2)} fill={i%2?Y:G} stroke={K} strokeWidth="4"/>)}<T y={740} size={48}>VALUE? VALUE? VALUE?</T></>,
({p})=><><T size={58}>“How much is listed?”</T><rect x="100" y="350" width="520" height="430" rx="20" fill={W} stroke={K} strokeWidth="5"/>{["HOTEL +$300","DINING +$200","STREAM +$120","POINTS +$???"].map((x,i)=><T key={x} x={140} y={440+i*80} size={34} anchor="start">{x}</T>)}<T y={860} size={42} color={R}>Wrong question.</T></>,
({p})=><><T size={58}>“Would I buy it anyway?”</T><Stick x={245} y={820} s={1.25} face="flat" label="DAVE"/><path d="M430 430 Q520 355 610 430 Q520 505 430 430 Z" fill={W} stroke={K} strokeWidth="5"/><T x={520} y={442} size={30}>ANYWAY?</T></>,
({p})=><><T>If you spend to unlock it…</T><Coupon x={250} y={520} label="SPEND" value="$300" color={R}/><path d="M390 520 H500" stroke={K} strokeWidth="8" strokeLinecap="round"/><polygon points="500,500 545,520 500,540" fill={K}/><Coupon x={530} y={520} label="CREDIT" value="$200" color={G} scale={.8}/><T y={820} size={44} color={R}>That didn’t save you money.</T></>,
({p})=><><T>Dave calls it premium.</T><Stick x={360} y={780} s={1.45} face="smile" label="DAVE" lean={I(p,0,1,-4,4)} arm={25}/><Card x={520} y={430} rot={I(p,0,1,-12,14)} scale={.72}/></>,
({p})=><><T>Points Monk calls it math.</T><Stick x={360} y={790} s={1.45} face="flat" label="POINTS MONK" arm={45}/><rect x="135" y="360" width="450" height="170" rx="20" fill={W} stroke={K} strokeWidth="5"/><T y={430} size={36}>REAL VALUE − FEE</T><T y={490} size={44} color={G}>= ?</T></>,
({p})=><><T size={57}>Count what you’d naturally use.</T><g transform="translate(360 580)"><circle cx="-150" cy="0" r="75" fill={G} stroke={K} strokeWidth="5"/><circle cx="0" cy="0" r="75" fill={Y} stroke={K} strokeWidth="5"/><circle cx="150" cy="0" r="75" fill={R} stroke={K} strokeWidth="5"/><T x={-150} y={12} size={28}>YES</T><T x={0} y={12} size={28}>MAYBE</T><T x={150} y={12} size={28}>NO</T></g></>,
({p})=><><T>Subtract the annual fee.</T><rect x="105" y="360" width="510" height="330" rx="24" fill={W} stroke={K} strokeWidth="5"/><T y={470} size={48}>NATURAL VALUE</T><T y={550} size={52} color={R}>− ANNUAL FEE</T><line x1="180" y1="590" x2="540" y2="590" stroke={K} strokeWidth="5"/><T y={655} size={58} color={G}>REAL RESULT</T></>,
({p})=><><T size={52}>Negative?</T><Card x={360} y={555} rot={I(p,0,1,-5,8)} scale={1.1}/><path d="M190 380 L530 730" stroke={R} strokeWidth="18" strokeLinecap="round"/><T y={905} size={48} color={R}>Expensive rectangle.</T><T y={1040} size={31}>Ignore the flex. Keep the math.</T></>
];

const cuts=[0,61,123,185,247,309,371,433,495,557,619,681,743,805,864];

export const CouponBookSnippet=()=>{
 const frame=useCurrentFrame();
 let n=cuts.length-2;
 for(let i=0;i<cuts.length-1;i++){if(frame>=cuts[i]&&frame<cuts[i+1]){n=i;break;}}
 const a=cuts[n],b=cuts[n+1],p=(frame-a)/(b-a);
 const Scene=scenes[n];
 const jitterX=Math.sin(frame*.38+n)*.9;
 const jitterY=Math.cos(frame*.29+n)*.6;
 return <AbsoluteFill style={{background:W,overflow:"hidden"}}>
   <Audio src={staticFile("audio/snippet-coupon-book.mp3")} volume={1}/>
   <Audio src={staticFile("audio/episode1-music.mp3")} volume={0.055}/>
   <Sequence from={2}><Audio src={staticFile("audio/episode1-sfx-1.mp3")} volume={0.45}/></Sequence>
   <Sequence from={495}><Audio src={staticFile("audio/episode1-sfx-2.mp3")} volume={0.35}/></Sequence>
   <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 20% 15%,rgba(0,0,0,.025) 0 1px,transparent 1.4px),radial-gradient(circle at 80% 70%,rgba(0,0,0,.018) 0 1px,transparent 1.4px)",backgroundSize:"18px 18px,23px 23px"}}/>
   <svg width="720" height="1280" viewBox="0 0 720 1280" style={{transform:`translate(${jitterX}px,${jitterY}px)`}}><Scene p={Math.max(0,Math.min(1,p))}/></svg>
 </AbsoluteFill>;
};
