import React from 'react';
import {v2BattleBeat} from './StudioLayout.mjs';
const K='#111',W='#fff';
const lerp=(a,b,p)=>a+(b-a)*p;
const Token=({x,y,r=12,opacity=1})=><g opacity={opacity}><circle cx={x} cy={y} r={r} fill={W} stroke={K} strokeWidth="3"/><path d={`M${x-4} ${y}h8M${x} ${y-4}v8`} stroke={K} strokeWidth="2"/></g>;
const Card=({x,y,label,subtitle,scale=1,rotation=0})=><g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
 <rect x="-104" y="-48" width="208" height="96" rx="14" fill={W} stroke={K} strokeWidth="4"/>
 <rect x="-80" y="-24" width="26" height="21" rx="3" fill="none" stroke={K} strokeWidth="2"/>
 <text x="12" y="-6" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="24" fill={K}>{label}</text>
 <text x="0" y="29" textAnchor="middle" fontFamily="Arial" fontSize="14" fill={K}>{subtitle}</text>
</g>;
const Label=({x=360,y=595,children,size=19})=><text x={x} y={y} textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize={size} fill={K}>{children}</text>;
// These bars are qualitative story metaphors, never dollar/points estimates.
const Meter=({x,y,width=200,fill=1,label})=><g><text x={x+width/2} y={y-10} textAnchor="middle" fontFamily="Arial" fontSize="15" fill={K}>{label}</text><rect x={x} y={y} width={width} height="20" rx="5" fill={W} stroke={K} strokeWidth="2"/><rect x={x+4} y={y+4} width={Math.max(0,(width-8)*fill)} height="12" rx="2" fill={K}/></g>;
export function V2BattleAction({scene,scenes,time}) {
 const beat=v2BattleBeat(scene.id);if(!beat)return null;
 const same=scenes.filter(s=>v2BattleBeat(s.id)===beat),start=Math.min(...same.map(s=>s.start)),end=Math.max(...same.map(s=>s.end));
 const p=Math.max(0,Math.min(1,(time-start)/(end-start))),smooth=p*p*(3-2*p);
 const chaseAttack=beat==='chase-strike',amexAttack=beat==='amex-counter',fee=beat==='fee-drain',transfer=beat==='points-summon',trap=beat==='trap',clash=beat==='final-clash',finish=beat==='finish';
 const entrance=beat==='cold-open'?1-smooth:0;
 // Three discrete combo strikes, each followed by the defender recoiling.
 const strikePhase=(p*3)%1;
 const lunge=Math.sin(Math.PI*strikePhase)*38;
 const recoil=Math.max(0,Math.sin(Math.PI*Math.max(0,strikePhase-.45)/.55))*18;
 const cy=402;
 return <g data-v2-beat={beat}>
  <Card x={190-entrance*8+(chaseAttack?lunge:0)} y={cy+(amexAttack?recoil:chaseAttack?-lunge*.25:0)} label="CHASE" subtitle={chaseAttack?'TRANSFER COMBO':'POINTS SYSTEM'} rotation={chaseAttack?Math.sin(p*Math.PI)*6:0}/>
  <Card x={530+entrance*8-(amexAttack?lunge:0)} y={cy+(chaseAttack?recoil:amexAttack?-lunge*.25:0)} label="AMEX" subtitle={amexAttack?'TRAVEL PERKS':'POINTS SYSTEM'} rotation={amexAttack?-Math.sin(p*Math.PI)*6:0}/>
  <Label y={410} size={23}>VS</Label>
  {chaseAttack||amexAttack?<g>
   <path d={chaseAttack?'M180 479Q360 540 540 479':'M540 479Q360 540 180 479'} fill="none" stroke={K} strokeWidth="3" strokeDasharray="7 8"/>
   {[0,1,2].map((offset,i)=>{const q=Math.max(0,Math.min(1,p*3-offset));return <Token key={i} x={chaseAttack?lerp(180,540,q):lerp(540,180,q)} y={479+Math.sin(q*Math.PI)*31} r={18} opacity={q>0&&q<1?1:0}/>;})}
   <Label>{chaseAttack?'TRANSFER COMBO →':'← TRAVEL PERK COUNTER'}</Label>
  </g>:null}
  {fee?<g>
   <Meter x={90} y={505} fill={1-smooth*.72} label="VALUE AFTER FEES"/>
   <Meter x={430} y={505} fill={1-smooth*.72} label="VALUE AFTER FEES"/>
   {[190,530].map(x=><g key={x}><Token x={x} y={535+smooth*27} opacity={Math.sin(p*Math.PI)}/><path d={`M${x-8} 556l8 8 8-8`} fill="none" stroke={K} strokeWidth="3"/></g>)}
   <Label>FEES REDUCE THE PAYOFF</Label>
  </g>:null}
  {transfer?<g>
   <rect x="75" y="492" width="150" height="54" rx="10" fill={W} stroke={K} strokeWidth="3"/><Label x={150} y={525}>POINTS</Label>
   <path d="M240 519H463l-10-8m10 8-10 8" stroke={K} strokeWidth="3" fill="none"/>
   <Token x={lerp(245,460,smooth)} y={519}/>
   <rect x="485" y="492" width="160" height="54" rx="10" fill={W} stroke={K} strokeWidth="3"/><Label x={565} y={525}>REDEMPTION</Label>
   <Label>HOW YOU USE THEM MATTERS</Label>
  </g>:null}
  {trap?<g>
   <Meter x={110} y={510} width={230} fill={1-smooth*.8} label="REDEMPTION VALUE"/>
   <path d="M376 530h72l-12-10m12 10-12 10" stroke={K} strokeWidth="3" fill="none"/>
   <path d="M487 484l90 0-15 65h-60z" fill={W} stroke={K} strokeWidth="3"/>
   <Token x={532} y={lerp(471,537,smooth)} r={lerp(12,3,smooth)} opacity={1-smooth}/>
   <Label>BAD REDEMPTION. LOST VALUE.</Label>
  </g>:null}
  {clash?<g>
   <path d="M190 467L300 495M530 467L420 495" pathLength="1" strokeDasharray="1" strokeDashoffset={clash?1-smooth:0} stroke={K} strokeWidth="3" fill="none"/>
   <rect x="240" y="490" width="240" height="65" rx="12" fill={W} stroke={K} strokeWidth="3"/>
   <Label y={517}>{finish?'BENEFITS YOU USE':'YOUR HABITS'}</Label>
   <Label y={541} size={15}>{finish?'YOUR WINNING SETUP':'SPENDING • TRAVEL • FEES'}</Label>
   {finish?<path d={`M330 578l18 17 42-35`} pathLength="1" strokeDasharray="1" strokeDashoffset={1-smooth} fill="none" stroke={K} strokeWidth="5"/>:<Label>THE PLAYER DECIDES THE BUILD</Label>}
  </g>:null}
  {finish?<g>
   <Label y={480} size={24}>BENEFITS YOU USE</Label>
   <path d="M280 535l55 45 105-85" pathLength="1" strokeDasharray="1" strokeDashoffset={1-p} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={K} strokeWidth="12"/>
   <Label y={617}>YOUR WINNING SETUP</Label>
  </g>:null}
  {beat==='cold-open'?<Label>TWO SYSTEMS. ONE PLAYER.</Label>:null}
 </g>;
}
