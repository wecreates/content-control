import React from 'react';
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from 'remotion';
import {Dave,PointsMonk} from './CharacterSystem';
import {PropIcon} from './PropSystem';
import {captionAtTime} from './ObservedCaptions.mjs';
import {speechMouthActivity} from './V2FacePerformance.mjs';

// Same character assets and observed audio timeline as the vertical studio.
// Text, actors and physical action occupy separate safe regions.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const Text=({children,x=640,y=160,size=34,maxWidth=1100})=><text x={x} y={y} textAnchor="middle" fill="#111" fontFamily="Arial,sans-serif" fontWeight="800" fontSize={Math.min(size,maxWidth/Math.max(1,String(children??'').length*.68))}>{children}</text>;
// Dialogue cuts must not restart the same physical action every two seconds.
export const longActionTiming=(scenes,index,time)=>{
 const action=scenes[index]?.visual?.action||'card_slam';
 let first=index,last=index;
 while(first>0&&(scenes[first-1].visual?.action||'card_slam')===action)first--;
 while(last+1<scenes.length&&(scenes[last+1].visual?.action||'card_slam')===action)last++;
 const start=scenes[first].start,end=scenes[last].end;
 return {action,start,end,progress:clamp((time-start)/(end-start))};
};
export const StudioLongComposition=({ccsd})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),time=frame/fps;
 const scenes=ccsd?.scenes||[],scene=scenes.find(s=>time>=s.start&&time<s.end);
 if(!scene)return <AbsoluteFill style={{background:'white'}}/>;
 const v=scene.visual||{},action=v.action||'card_slam';
 const timing=longActionTiming(scenes,scenes.indexOf(scene),time),p=timing.progress,beat=ease((time-timing.start)/.65);
 const elapsed=time-timing.start;
 // Physical explanatory cycles: suspended fee, reward delivery, monthly bill,
 // and a payment travelling into its calendar cell. Never reset on dialogue cuts.
 const cycle=(period,offset=0)=>((elapsed+offset)%period)/period;
 const paymentMonth=Math.min(11,Math.floor(p*12)),paymentPhase=(p*12)%1;
 const monthX=508+(paymentMonth%4)*88,monthY=308+Math.floor(paymentMonth/4)*90;
 const cue=captionAtTime(ccsd.caption_track,time);
 const bob=Math.sin(time*3)*6,reach=Math.sin(p*Math.PI)*24;
 const label=String(v.label||'');
 const prop=(id,x=640,y=390,scale=1.2,rotation=0)=><PropIcon id={id} x={x} y={y} s={scale} rotation={rotation}/>;
 const money=(value,x,y)=><g transform={`translate(${x} ${y})`}><rect x="-95" y="-38" width="190" height="76" rx="12" fill="white" stroke="#111" strokeWidth="4"/><Text x={0} y={10} size={26} maxWidth={164}>{value}</Text></g>;
 let art;
 if(action==='fee_drop')art=<>{<g data-causal-motion="fee-weight" transform={`rotate(${12*Math.sin(elapsed*2.4)} 640 225)`}><path d="M640 220 V270" stroke="#111" strokeWidth="5"/>{prop('receipt',640,240+beat*140,1.4)}</g>}{money('$200 FEE',640,565)}</>;
 else if(action==='points')art=<>{[0,1,2].map(i=><g key={i}>{prop('coin',520+i*120,390-Math.abs(Math.sin(time*2+i))*60,.85)}</g>)}<Text y={530}>30,000 POINTS</Text></>;
 else if(action==='redemption')art=<>{money('30,000',520-25*p,330)}<Text x={640} y={343}>→</Text>{money('$210',760+25*p,330)}{prop('shopping_cart',640+Math.sin(time*2)*35,500,.9)}</>;
 else if(action==='credit_chase')art=<>{prop('phone',610+Math.sin(time*3)*70,400,1.3,Math.sin(time*3)*9)}{money('$10 CREDIT',650,235)}</>;
 else if(action==='scoreboard')art=<>{money('PREMIUM $70',570,305)}{money('FREE $200',700,465)}<path d="M470 370 Q425 550 485 550 H800" fill="none" stroke="#111" strokeWidth="4"/><Text x={665} y={600} size={24}>$130 MORE NET VALUE</Text>{[0,1,2].map(i=>{const q=cycle(3,i);return <g key={i} data-causal-motion="net-value-delivery">{prop('coin',450+340*q,545+10*Math.sin(q*Math.PI),.4)}</g>;})}</>;
 else if(action==='interest')art=<><g transform={`translate(${650+Math.sin(time*2)*25},380) scale(${1+.08*Math.sin(time*2)})`}><path d="M-105 100 Q-150 -130 0 -120 Q145 -100 110 100 L60 70 L0 108 L-60 70 Z" fill="#111"/><circle cx="-38" cy="-35" r="14" fill="white"/><circle cx="38" cy="-35" r="14" fill="white"/><path d="M-40 30 L40 30" stroke="white" strokeWidth="6"/></g><Text y={555}>INTEREST</Text></>;
 else if(action==='autopay')art=<>{money('MINIMUM',640,305)}{money('STATEMENT',640,450)}<path d={`M790 ${310+140*beat} l-40 -12 v24 Z`} fill="#111"/><path d="M560 525 l25 25 l55 -60" fill="none" stroke="#111" strokeWidth="7"/><Text x={705} y={575} size={20}>REPEAT EACH MONTH</Text><g data-causal-motion="monthly-statement">{prop('receipt',435,250+320*cycle(2.5),.46)}</g><path d="M455 565 Q480 590 515 565" fill="none" stroke="#111" strokeWidth="4"/></>;
 else if(action==='bonus')art=<>{prop('carrot',640+Math.sin(time*2)*35,350,1.3,-20)}{money('$300 BONUS',640,530)}</>;
 else if(action==='cart')art=<>{prop('shopping_cart',640+Math.sin(time*2)*28,440,1.5)}<g transform={`translate(640,${300-reach})`}><path d="M-50 -65 V70 M50 -65 V70 M-50 -40 H50 M-50 0 H50 M-50 40 H50" stroke="#111" strokeWidth="6"/></g></>;
 else if(action==='terms')art=<>{prop('loan_contract',610,390,1.6)}{prop('magnifying_glass',700+Math.sin(time*2)*24,380+Math.cos(time*2)*30,.9)}</>;
 else if(action==='doors')art=<>{[535,745].map((x,i)=><g key={x}><rect x={x-75} y="270" width="150" height="260" rx="4" fill="white" stroke="#111" strokeWidth="5"/><Text x={x} y={350} size={46}>{i?'0%*':'0%'}</Text><Text x={x} y={475} size={17} maxWidth={128}>{i?'DEFERRED':'INTRO APR'}</Text><circle cx={x+48} cy="415" r="7" fill="#111"/></g>)}<path d={`M670 540 L820 540 L${820-65*beat} ${540+45*beat} L${670-30*beat} ${540+45*beat} Z`} fill="#111"/></>;
 else if(action==='calendar')art=<>{Array.from({length:12},(_,i)=><g key={i}><rect x={470+i%4*88} y={270+Math.floor(i/4)*90} width="76" height="76" rx="6" fill={i<Math.min(12,Math.floor(p*12))?'#eee':'white'} stroke="#111" strokeWidth="3"/><Text x={508+i%4*88} y={315+Math.floor(i/4)*90} size={20}>$100</Text>{i<paymentMonth&&<path d={`M${482+i%4*88} ${331+Math.floor(i/4)*90} l8 7 l15 -15`} fill="none" stroke="#111" strokeWidth="3"/>}</g>)}<g data-causal-motion="monthly-payment">{prop('coin',390+(monthX-390)*paymentPhase,monthY+48,.55)}</g></>;
 else if(action==='callback')art=<>{prop('card',640,480,1.65)}<path d={`M${560+150*p} ${300+30*Math.abs(Math.sin(time*8))} l95 90`} stroke="#111" strokeWidth="10"/></>;
 else art=<>{prop('card',640,250+beat*145,1.8,-8+16*p)}<path d="M480 500 H800" stroke="#111" strokeWidth="6"/></>;
 return <AbsoluteFill style={{background:'white'}}><svg viewBox="0 0 1280 720" width="100%" height="100%">
  <rect width="1280" height="720" fill="white"/>
  <Text y={73} size={36}>{cue?.text||''}</Text>
  <Text y={155} size={label.length>34?26:32}>{label}</Text>
  <g data-long-action={action} data-action-progress={p}>{art}</g>
  <Dave x={245} y={460+bob} s={1.13} arm={reach} lean={action==='fee_drop'?(-8-5*Math.sin(elapsed*2.4))*beat:Math.sin(time*2)*3} mood={['fee_drop','interest'].includes(action)?'shock':'smile'} label="" mouthOpen={speechMouthActivity('dave',time,cue)} blink={frame%91<3?.12:1}/>
  <PointsMonk x={1035} y={465-bob*.3} s={1.06} arm={-10-reach} lean={Math.sin(time*1.5)*2} label="" mouthOpen={speechMouthActivity('points_monk',time,cue)} blink={frame%113<3?.12:1}/>
  <path d="M140 642 H1140" stroke="#111" strokeWidth="3"/>
 </svg></AbsoluteFill>;
};
