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
// Card stroke bounds must clear the headline even at the first frame.
export const cardSlamPose=elapsed=>({y:320+40*ease(elapsed/.65),scale:1.8,angle:12*Math.sin(elapsed*4)*Math.exp(-elapsed/10)});
// Keep the entire rotated invoice below headlines and above its fee badge.
export const feeReceiptPose=elapsed=>({y:345+45*ease(elapsed/.65),scale:1.15,angle:12*Math.sin(elapsed*2.4),pivotY:225});
export const longActorPose=(action,elapsed)=>{
 const contact=['fee_drop','cart','callback'].includes(action);
 const strike=Math.max(0,Math.sin(elapsed*5));
 return {dave:{x:contact?360:245,y:contact?491:460,scale:contact?1:1.13,
  lean:action==='fee_drop'?-8-5*Math.sin(elapsed*2.4):action==='callback'?-8*strike:action==='cart'?7:Math.sin(elapsed*2)*3,
  hand:contact?{x:action==='callback'?150:115,y:action==='callback'?-130+70*strike:action==='cart'?-75:-110}:undefined},
  monk:{x:['scoreboard','autopay','doors'].includes(action)?930:1035,y:['scoreboard','autopay','doors'].includes(action)?481:465,scale:['scoreboard','autopay','doors'].includes(action)?1:1.06,
  hand:['scoreboard','autopay','doors'].includes(action)?{x:-120,y:action==='autopay'?-30:-110}:undefined}};
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
 const actors=longActorPose(action,elapsed),receipt=feeReceiptPose(elapsed);
 const cue=captionAtTime(ccsd.caption_track,time);
 const bob=Math.sin(time*3)*6,reach=Math.sin(p*Math.PI)*24;
 const label=String(v.label||'');
 const prop=(id,x=640,y=390,scale=1.2,rotation=0)=><PropIcon id={id} x={x} y={y} s={scale} rotation={rotation}/>;
 const money=(value,x,y)=><g transform={`translate(${x} ${y})`}><rect x="-95" y="-38" width="190" height="76" rx="12" fill="white" stroke="#111" strokeWidth="4"/><Text x={0} y={10} size={26} maxWidth={164}>{value}</Text></g>;
 let art;
 if(action==='fee_drop')art=<>{<g data-causal-motion="fee-weight" transform={`rotate(${receipt.angle} 640 ${receipt.pivotY})`}><path d={`M640 225 V${receipt.y-90*receipt.scale}`} stroke="#111" strokeWidth="5"/>{prop('receipt',640,receipt.y,receipt.scale)}</g>}{money('$200 FEE',640,565)}</>;
 else if(action==='points')art=<>{[0,1,2].map(i=><g key={i}>{prop('coin',520+i*120,390-Math.abs(Math.sin(time*2+i))*60,.85)}</g>)}<Text y={530}>30,000 POINTS</Text></>;
 else if(action==='redemption')art=<>{money('30,000',520-25*p,330)}<Text x={640} y={343}>→</Text>{money('$210',760+25*p,330)}<g data-causal-motion="redemption-conversion">{[0,1].map(i=><g key={i}>{prop('points_counter',450+350*cycle(2.2,i*1.1),500,.65)}</g>)}<path d="M460 570 H805 l-18 -10 m18 10 l-18 10" fill="none" stroke="#111" strokeWidth="4"/><Text y={615} size={23}>30,000 × $0.007 = $210</Text></g></>;
 else if(action==='credit_chase')art=<>{prop('phone',610+Math.sin(time*3)*70,400,1.3,Math.sin(time*3)*9)}{money('$10 CREDIT',650,235)}</>;
 else if(action==='scoreboard')art=<>{money('PREMIUM $70',570,305)}{money('FREE $200',700,465)}<path d="M470 370 Q425 550 485 550 H800" fill="none" stroke="#111" strokeWidth="4"/><Text x={665} y={600} size={24}>$130 MORE NET VALUE</Text>{[0,1,2].map(i=>{const q=cycle(3,i);return <g key={i} data-causal-motion="net-value-delivery">{prop('coin',450+340*q,545+10*Math.sin(q*Math.PI),.55)}</g>;})}</>;
 else if(action==='interest')art=<><g data-causal-motion="interest-reaches-reward">{prop('coin',425+120*cycle(2.5),355+65*cycle(2.5),.65)}<path d={`M560 385 Q515 355 ${445+120*cycle(2.5)} ${355+65*cycle(2.5)}`} fill="none" stroke="#111" strokeWidth="8"/></g><g transform={`translate(${650+Math.sin(time*2)*25},380) scale(${1+.08*Math.sin(time*2)})`}><path d="M-105 100 Q-150 -130 0 -120 Q145 -100 110 100 L60 70 L0 108 L-60 70 Z" fill="#111"/><circle cx="-38" cy="-35" r="14" fill="white"/><circle cx="38" cy="-35" r="14" fill="white"/><path d="M-40 30 L40 30" stroke="white" strokeWidth="6"/></g><Text y={555}>INTEREST</Text></>;
 else if(action==='autopay')art=<>{money('MINIMUM',640,305)}{money('STATEMENT',640,450)}<path d={`M790 ${310+140*beat} l-40 -12 v24 Z`} fill="#111"/><path d="M560 525 l25 25 l55 -60" fill="none" stroke="#111" strokeWidth="7"/><Text x={705} y={575} size={20}>REPEAT EACH MONTH</Text><g data-causal-motion="monthly-statement">{prop('receipt',435,250+320*cycle(2.5),.46)}</g><path d="M455 565 Q480 590 515 565" fill="none" stroke="#111" strokeWidth="4"/></>;
 else if(action==='bonus')art=<>{prop('carrot',640+Math.sin(time*2)*35,350,1.3,-20)}{money('$300 BONUS',640,530)}</>;
 else if(action==='cart')art=<>{prop('shopping_cart',640+Math.sin(time*2)*28,440,1.5)}<g data-causal-motion="overloaded-shopping-cart" transform={`translate(${640+Math.sin(elapsed*2)*25},${300-18*Math.abs(Math.sin(elapsed*2))}) rotate(${9*Math.sin(elapsed*2)})`}><path d="M-50 -65 V70 M50 -65 V70 M-50 -40 H50 M-50 0 H50 M-50 40 H50" stroke="#111" strokeWidth="6"/></g></>;
 else if(action==='terms')art=<>{prop('loan_contract',610,390,1.6)}{prop('magnifying_glass',700+Math.sin(time*2)*24,380+Math.cos(time*2)*30,.9)}</>;
 else if(action==='doors')art=<>{[535,745].map((x,i)=><g key={x}><rect x={x-75} y="270" width="150" height="260" rx="4" fill="white" stroke="#111" strokeWidth="5"/><Text x={x} y={350} size={46}>{i?'0%*':'0%'}</Text><Text x={x} y={475} size={17} maxWidth={128}>{i?'DEFERRED':'INTRO APR'}</Text><circle cx={x+48} cy="415" r="7" fill="#111"/>{i===1&&<g data-causal-motion="deferred-interest-terms"><rect x={x-65} y="365" width="130" height="80" fill="white" stroke="#111" strokeWidth="3"/>{[0,1,2].map(row=><path key={row} d={`M${x-54} ${374+((elapsed*65+row*22)%62)} h108`} stroke="#111" strokeWidth="5"/>)}</g>}</g>)}<path d={`M670 540 L820 540 L${820-65*beat} ${540+45*beat} L${670-30*beat} ${540+45*beat} Z`} fill="#111"/></>;
 else if(action==='calendar')art=<>{Array.from({length:12},(_,i)=><g key={i}><rect x={470+i%4*88} y={270+Math.floor(i/4)*90} width="76" height="76" rx="6" fill={i<Math.min(12,Math.floor(p*12))?'#eee':'white'} stroke="#111" strokeWidth="3"/><Text x={508+i%4*88} y={315+Math.floor(i/4)*90} size={20}>$100</Text>{i<paymentMonth&&<path d={`M${482+i%4*88} ${331+Math.floor(i/4)*90} l8 7 l15 -15`} fill="none" stroke="#111" strokeWidth="3"/>}</g>)}<g data-causal-motion="monthly-payment"><g transform={`translate(${440+330*cycle(1.5)} 575)`}><rect x="-80" y="-30" width="160" height="60" rx="6" fill="white" stroke="#111" strokeWidth="4"/><path d="M-80 -30 L0 4 L80 -30" fill="none" stroke="#111" strokeWidth="3"/><Text x={0} y={22} size={18}>$100 PAYMENT</Text></g></g></>;
 else if(action==='callback')art=<g data-causal-motion="card-cutting-board-callback">{prop('card',640,480,1.65)}{[0,1,2,3].map(i=><g key={i} transform={`translate(${625+i*33+Math.max(0,Math.sin(elapsed*5))*i*3} 460)`}><ellipse rx="14" ry="20" fill="#fff" stroke="#111" strokeWidth="4"/><path d="M-5 -10 L5 10 M5 -10 L-5 10" stroke="#111" strokeWidth="2"/></g>)}<g data-kitchen-knife="original-svg" transform={`translate(600 ${355+75*Math.max(0,Math.sin(elapsed*5))})`}><rect x="-88" y="-6" width="72" height="23" rx="8" fill="#111"/><path d="M-16 -6 H108 Q108 48 66 48 H-16 Z" fill="white" stroke="#111" strokeWidth="5"/><path d="M-8 36 H66" stroke="#111" strokeWidth="2"/></g><path d="M440 580 H835" stroke="#111" strokeWidth="6"/><Text y={620} size={23}>ONE USE. NO INTEREST.</Text></g>;
 else {const card=cardSlamPose(elapsed);art=<>{prop('card',640,card.y,card.scale,card.angle)}<path d="M480 500 H800" stroke="#111" strokeWidth="6"/></>;}
 return <AbsoluteFill style={{background:'white'}}><svg viewBox="0 0 1280 720" width="100%" height="100%">
  <rect width="1280" height="720" fill="white"/>
  <Text y={73} size={36}>{cue?.text||''}</Text>
  <Text y={155} size={label.length>34?26:32}>{label}</Text>
  <g data-long-action={action} data-action-progress={p}>{art}</g>
  <Dave x={actors.dave.x} y={actors.dave.y+bob} s={actors.dave.scale} arm={reach} rightHandTarget={actors.dave.hand} lean={['fee_drop','cart','callback'].includes(action)?actors.dave.lean:Math.sin(time*2)*3} mood={['fee_drop','interest'].includes(action)?'shock':'smile'} label="" mouthOpen={speechMouthActivity('dave',time,cue)} blink={frame%91<3?.12:1}/>
  <PointsMonk x={actors.monk.x} y={actors.monk.y-bob*.3} s={actors.monk.scale} arm={-10-reach} leftHandTarget={actors.monk.hand} lean={Math.sin(time*1.5)*2} label="" mouthOpen={speechMouthActivity('points_monk',time,cue)} blink={frame%113<3?.12:1}/>
  <path d="M140 642 H1140" stroke="#111" strokeWidth="3"/>
 </svg></AbsoluteFill>;
};
