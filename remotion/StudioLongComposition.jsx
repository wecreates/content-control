import React from 'react';
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from 'remotion';
import {Dave,PointsMonk} from './CharacterSystem';
import {PropIcon} from './PropSystem';
import {captionAtTime} from './ObservedCaptions.mjs';

// Same character assets and observed audio timeline as the vertical studio.
// Text, actors and physical action occupy separate safe regions.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const Text=({children,x=640,y=160,size=34})=><text x={x} y={y} textAnchor="middle" fill="#111" fontFamily="Arial,sans-serif" fontWeight="800" fontSize={size}>{children}</text>;
export const StudioLongComposition=({ccsd})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),time=frame/fps;
 const scenes=ccsd?.scenes||[],scene=scenes.find(s=>time>=s.start&&time<s.end);
 if(!scene)return <AbsoluteFill style={{background:'white'}}/>;
 const v=scene.visual||{},action=v.action||'card_slam';
 const local=time-scene.start,p=clamp(local/(scene.end-scene.start)),beat=ease(p*2);
 const cue=captionAtTime(ccsd.caption_track,time),speaker=cue?.speaker;
 const bob=Math.sin(time*3)*6,reach=Math.sin(p*Math.PI)*24;
 const label=String(v.label||'').slice(0,48);
 const prop=(id,x=640,y=390,scale=1.2,rotation=0)=><PropIcon id={id} x={x} y={y} s={scale} rotation={rotation}/>;
 const money=(value,x,y)=><g transform={`translate(${x} ${y})`}><rect x="-95" y="-38" width="190" height="76" rx="12" fill="white" stroke="#111" strokeWidth="4"/><Text x={0} y={12} size={28}>{value}</Text></g>;
 let art;
 if(action==='fee_drop')art=<>{prop('receipt',640,240+beat*140,1.4)}{money('$200 FEE',640,400)}<path d={`M530 ${540+reach} L750 ${540+reach}`} stroke="#111" strokeWidth="7"/></>;
 else if(action==='points')art=<>{[0,1,2].map(i=><g key={i}>{prop('coin',520+i*120,390-Math.abs(Math.sin(time*2+i))*60,.85)}</g>)}<Text y={530}>30,000 POINTS</Text></>;
 else if(action==='redemption')art=<>{money('30,000',520-25*p,330)}<Text x={640} y={343}>→</Text>{money('$210',760+25*p,330)}{prop('shopping_cart',640+Math.sin(time*2)*35,500,.9)}</>;
 else if(action==='credit_chase')art=<>{prop('phone',610+Math.sin(time*3)*70,400,1.3,Math.sin(time*3)*9)}{money('$10 CREDIT',650,235)}</>;
 else if(action==='scoreboard')art=<>{money('PREMIUM $70',630,330)}{money('FREE $200',630+25*Math.sin(p*Math.PI),460)}<path d="M505 530 H775" stroke="#111" strokeWidth="6"/></>;
 else if(action==='interest')art=<><g transform={`translate(${650+Math.sin(time*2)*25},380) scale(${1+.08*Math.sin(time*2)})`}><path d="M-105 100 Q-150 -130 0 -120 Q145 -100 110 100 L60 70 L0 108 L-60 70 Z" fill="#111"/><circle cx="-38" cy="-35" r="14" fill="white"/><circle cx="38" cy="-35" r="14" fill="white"/><path d="M-40 30 L40 30" stroke="white" strokeWidth="6"/></g><Text y={555}>INTEREST</Text></>;
 else if(action==='autopay')art=<>{money('MINIMUM',640,325)}{money('STATEMENT',640,460)}<path d={`M790 ${320+140*beat} l-40 -12 v24 Z`} fill="#111"/></>;
 else if(action==='bonus')art=<>{prop('carrot',640+Math.sin(time*2)*35,380,1.6,-20)}{money('$300 BONUS',640,530)}</>;
 else if(action==='cart')art=<>{prop('shopping_cart',640+Math.sin(time*2)*28,440,1.5)}<g transform={`translate(640,${300-reach})`}><path d="M-50 -65 V70 M50 -65 V70 M-50 -40 H50 M-50 0 H50 M-50 40 H50" stroke="#111" strokeWidth="6"/></g></>;
 else if(action==='terms')art=<>{prop('loan_contract',610,390,1.6)}{prop('magnifying_glass',700+Math.sin(time*2)*24,380+Math.cos(time*2)*30,.9)}</>;
 else if(action==='doors')art=<>{[535,745].map((x,i)=><g key={x}><rect x={x-75} y="270" width="150" height="260" rx="4" fill="white" stroke="#111" strokeWidth="5"/><Text x={x} y={350} size={46}>{i?'0%*':'0%'}</Text><circle cx={x+48} cy="415" r="7" fill="#111"/></g>)}<path d={`M670 540 L820 540 L${820-65*beat} ${540+45*beat} L${670-30*beat} ${540+45*beat} Z`} fill="#111"/></>;
 else if(action==='calendar')art=<>{Array.from({length:12},(_,i)=><g key={i}><rect x={470+i%4*88} y={270+Math.floor(i/4)*90} width="76" height="76" rx="6" fill={i<=Math.floor(p*12)?'#eee':'white'} stroke="#111" strokeWidth="3"/><Text x={508+i%4*88} y={315+Math.floor(i/4)*90} size={20}>$100</Text></g>)}</>;
 else if(action==='callback')art=<>{prop('card',640,480,1.65)}<path d={`M${560+150*p} ${300+30*Math.abs(Math.sin(time*8))} l95 90`} stroke="#111" strokeWidth="10"/></>;
 else art=<>{prop('card',640,250+beat*145,1.8,-8+16*p)}<path d="M480 500 H800" stroke="#111" strokeWidth="6"/></>;
 return <AbsoluteFill style={{background:'white'}}><svg viewBox="0 0 1280 720" width="100%" height="100%">
  <rect width="1280" height="720" fill="white"/>
  <Text y={73} size={36}>{cue?.text||''}</Text>
  <Text y={155} size={label.length>34?26:32}>{label}</Text>
  <g>{art}</g>
  <Dave x={245} y={460+bob} s={1.13} arm={reach} lean={action==='fee_drop'?-8*beat:Math.sin(time*2)*3} mood={['fee_drop','interest'].includes(action)?'shock':'smile'} label="" mouthOpen={speaker==='dave'?.3+.5*Math.abs(Math.sin(time*14)):0} blink={frame%91<3?.12:1}/>
  <PointsMonk x={1035} y={465-bob*.3} s={1.06} arm={-10-reach} lean={Math.sin(time*1.5)*2} label="" mouthOpen={speaker==='points_monk'?.25+.5*Math.abs(Math.sin(time*13)):0} blink={frame%113<3?.12:1}/>
  <path d="M140 642 H1140" stroke="#111" strokeWidth="3"/>
 </svg></AbsoluteFill>;
};
