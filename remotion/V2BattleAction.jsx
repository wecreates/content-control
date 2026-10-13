import React from 'react';
import {v2BattleBeat,v2CapeMotion} from './StudioLayout.mjs';
const K='#111',W='#fff',clamp=v=>Math.max(0,Math.min(1,v));
const mix=(a,b,p)=>a+(b-a)*p;
const ease=p=>p*p*(3-2*p);
const Word=({x=360,y=620,size=24,children})=>y===620?null:<text x={x} y={y} textAnchor="middle" fontFamily="Arial" fontWeight="800" fontSize={size} fill={K}>{children}</text>;
const Card=({x,y,label,rotation=0})=><g transform={`translate(${x} ${y}) rotate(${rotation})`}><rect x="-87" y="-42" width="174" height="84" rx="13" fill={W} stroke={K} strokeWidth="5"/><rect x="-64" y="-19" width="23" height="20" rx="3" fill="none" stroke={K} strokeWidth="3"/><text x="16" y="9" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="23" fill={K}>{label}</text></g>;
const Wallet=({x=360,y=480,s=1,rotation=0,label=''})=><g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${s})`}><rect x="-110" y="-66" width="220" height="132" rx="20" fill={W} stroke={K} strokeWidth="6"/><path d="M-85-42H65" stroke={K} strokeWidth="3"/><rect x="45" y="-20" width="79" height="45" rx="9" fill={W} stroke={K} strokeWidth="5"/><circle cx="67" cy="3" r="5" fill={K}/>{label?<text x="-28" y="19" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="25" fill={K}>{label}</text>:null}</g>;
const Sandwich=({x,y,s=1,rotation=0})=><g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${s})`}><path d="M-56 18L0-38 56 18Z" fill={W} stroke={K} strokeWidth="5" strokeLinejoin="round"/><path d="M-56 18v14H56V18M-47 21l14 7 14-7 14 7 14-7 14 7 15-7" fill={W} stroke={K} strokeWidth="4"/><path d="M-4-16l9 6M-20 2l6 3" stroke={K} strokeWidth="3"/></g>;
const Coin=({x,y,s=1,opacity=1})=><g opacity={opacity}><circle cx={x} cy={y} r={14*s} fill={W} stroke={K} strokeWidth="4"/><path d={`M${x-4*s} ${y}h${8*s}`} stroke={K} strokeWidth="3"/></g>;
const Sword=({x,y,rotation=0,s=1})=><g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${s})`}><path d="M-94-15H72L112 0 72 15H-94Z" fill={W} stroke={K} strokeWidth="5"/><path d="M-72 0H83M-96-31V31M-124 0H-98" fill="none" stroke={K} strokeWidth="7" strokeLinecap="round"/></g>;
const Cape=({x,y,s=1,rotation=0})=><g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${s})`}><path d="M-35-75L-105 90Q-42 65 0 95Q45 65 105 90L35-75Q0-55-35-75Z" fill={K}/><path d="M-25-49L-58 66M25-49L58 66" stroke={W} strokeWidth="3"/></g>;
const FeeJaw=({x,y,open=1,s=1})=><g transform={`translate(${x} ${y}) scale(${s})`}><text x="0" y="-80" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="31" fill={K}>FEE</text><g transform={`translate(0 ${-open*27})`}><path d="M-80-28Q0-90 80-28L60-5 40-28 20-5 0-28-20-5-40-28-60-5Z" fill={W} stroke={K} strokeWidth="5"/></g><g transform={`translate(0 ${open*27})`}><path d="M-80 28Q0 90 80 28L60 5 40 28 20 5 0 28-20 5-40 28-60 5Z" fill={W} stroke={K} strokeWidth="5"/></g></g>;
const Button=({x,label,pressed=false})=><g><rect x={x-122} y="356" width="244" height="72" rx="12" fill={pressed?K:W} stroke={K} strokeWidth="5"/><text x={x} y="400" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="23" fill={pressed?W:K}>{label}</text></g>;

export function v2WalletMotion(beat,p) {
 if(beat==='finish'){
  const lift=ease(clamp(p/.32)),settle=clamp((p-.32)/.28);
  return {x:360,y:462+34*(1-lift)-Math.sin(settle*Math.PI)*10,s:1.3,rotation:0};
 }
 if(beat==='trap'){
  const spill=clamp((p-.12)/.72),tilt=Math.sin(spill*Math.PI);
  return {x:360,y:532-tilt*14,s:.54,rotation:-28*tilt};
 }
 return null;
}
export function V2BattleAction({scene,scenes,time}) {
 const beat=v2BattleBeat(scene.id);if(!beat)return null;
 const same=scenes.filter(s=>v2BattleBeat(s.id)===beat),start=Math.min(...same.map(s=>s.start)),end=Math.max(...same.map(s=>s.end));
 const p=clamp((time-start)/(end-start)),q=ease(p);
 const strike=clamp((p-.12)/.55),contact=Math.max(0,Math.sin(strike*Math.PI));
 const rebound=ease(clamp((p-.67)/.33));
 return <g data-v2-beat={beat}>
  {beat==='cold-open'?<g>
   <Card x={175+q*32} y={434} label="CHASE" rotation={q*12}/><Card x={545-q*32} y={434} label="AMEX" rotation={-q*12}/>
   <Wallet x={360} y={510} s={.76} rotation={Math.sin(p*Math.PI*2)*7}/>
   {[0,1].map(i=><path key={i} d={`M${i?510:210} 487L${mix(i?500:220,360,q)} ${mix(490,483,q)}`} stroke={K} strokeWidth="10" strokeLinecap="round"/>)}
   <Word>WHY IS MY WALLET THE BOSS?</Word>
  </g>:null}
  {beat==='chase-strike'?<g>
   <Card x={180} y={434} label="CHASE"/><Card x={540} y={434} label="AMEX"/>
   <Sword x={mix(250,435,strike)-rebound*145} y={480-contact*22-rebound*36} rotation={mix(-24,12,strike)-rebound*42} s={1.15}/>
   <Wallet x={530+contact*18} y={530+contact*24} s={.38} rotation={contact*30}/>
   <Word size={26}>SWORD: HUGE. BUDGET: MISSING.</Word>
  </g>:null}
  {beat==='amex-counter'?<g>
   <Cape {...v2CapeMotion(p)}/>
   <path d="M460 330L355 566H610Z" fill="none" stroke={K} strokeWidth="2" strokeDasharray="8 8" opacity={q}/>
   <Sandwich x={470} y={492-q*32} s={.65+q*.4} rotation={-8+q*8}/>
   <Word>THE PERK HAS A CRUST.</Word>
  </g>:null}
  {beat==='fee-drain'?<g>
   <Sandwich x={220} y={365} s={.7}/>
   <Wallet x={240-contact*18} y={503} s={.82} rotation={contact*-8}/>
   <FeeJaw x={mix(540,360,q)} y={500} open={.15+.85*Math.abs(Math.sin(p*Math.PI*2))} s={.8}/>
   <Word>THE SNACK HAS COMPANY.</Word>
  </g>:null}
  {beat==='points-summon'?<g>
   <Sandwich x={mix(150,270,q)} y={430} s={1.05}/>
   <path d="M130 490H390" stroke={K} strokeWidth="4"/>
   <Word x={260} y={527} size={23}>INVITED</Word>
   <g transform={`translate(${mix(550,488,q)} ${mix(385,468,q)}) rotate(${-12+q*12})`}><rect x="-78" y="-70" width="156" height="138" rx="8" fill={W} stroke={K} strokeWidth="5"/><path d="M-78-70L0-8 78-70" stroke={K} strokeWidth="4" fill="none"/><text x="0" y="40" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="34" fill={K}>FEE</text></g>
   <Word>NOT ON THE GUEST LIST.</Word>
  </g>:null}
  {beat==='trap'?<g>
   <Button x={210} label="PANIC TAP" pressed={p>.12}/><Button x={510} label="CHECK VALUE"/>
   <Wallet {...v2WalletMotion('trap',p)}/>
   {Array.from({length:5},(_,i)=>{const escape=clamp((p-.12)/.88);return <Coin key={i} x={360+(i-2)*104*escape} y={535-Math.sin(escape*Math.PI)*(60+i%2*34)+escape*40} s={1.5} opacity={p>.12?1:0}/>;})}
   <Word>THE BUTTON WAS A WARNING.</Word>
  </g>:null}
  {beat==='final-clash'?<g>
   <Cape x={125} y={mix(420,516,q)} s={.42} rotation={q*-70}/>
   <Sword x={mix(190,200,q)} y={438} rotation={10} s={.65}/><Sword x={mix(540,520,q)} y={485} rotation={175} s={.65}/>
   <path d="M260 333Q360 365 460 333V501Q446 574 360 612Q274 574 260 501Z" fill={W} stroke={K} strokeWidth="7"/>
   {['NEEDS','COSTS','USE'].map((label,i)=><g key={label}><Word x={378} y={405+i*60} size={26}>{label}</Word><path d={`M282 ${394+i*60}l13 13 22-29`} pathLength="1" strokeDasharray="1" strokeDashoffset={1-clamp(p*3-i)} fill="none" stroke={K} strokeWidth="6"/></g>)}
  </g>:null}
  {beat==='finish'?<g>
   <Wallet {...v2WalletMotion('finish',p)} label="BUDGET"/>
   <Sandwich x={360} y={mix(610,582,q)} s={.58}/>
   <path d="M205 550Q360 730 515 550" fill="none" stroke={K} strokeWidth="6" strokeLinecap="round"/>
   <Word y={349} size={28}>CAPE OPTIONAL.</Word>
  </g>:null}
 </g>;
}
