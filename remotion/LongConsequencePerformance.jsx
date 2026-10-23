import React from 'react';
import {Dave,PointsMonk} from './CharacterSystem';
import {PropIcon} from './PropSystem';
import {captionAtTime} from './ObservedCaptions.mjs';
import {speechMouthActivity} from './V2FacePerformance.mjs';
import {consequenceTiming,feeConsequencePose,deletionPose,auditCartPose,matchesLongConsequence} from './LongConsequenceMotion.mjs';
export {matchesLongConsequence};
const K='#111',R='#d83532',G='#268449';
const Text=({children,x=640,y=155,size=32,width=1100,fill=K})=><text x={x} y={y} textAnchor="middle" fill={fill} fontFamily="Arial,sans-serif" fontWeight="800" fontSize={Math.min(size,width/Math.max(1,String(children??'').length*.68))}>{children}</text>;
const Ladder=({x,y,scale=1,angle=0})=><g data-prop="decorative-ladder" transform={`translate(${x} ${y}) scale(${scale}) rotate(${angle})`} stroke={K} strokeWidth="7" strokeLinecap="round"><path d="M-34 -80 V80 M34 -80 V80 M-34 -58 H34 M-34 -14 H34 M-34 30 H34 M-34 70 H34" fill="none"/></g>;
const Groceries=({x,y})=><g data-prop="planned-groceries" transform={`translate(${x} ${y})`}><path d="M-33 -38 H33 L29 40 H-29 Z" fill="#edf6ed" stroke={K} strokeWidth="4"/><path d="M-12 -38 Q-25 -76 -12 -81 Q4 -80 3 -38 M8 -38 Q2 -68 20 -69 Q36 -56 22 -38" fill="white" stroke={K} strokeWidth="4"/><Text x={0} y={12} size={13} width={54}>FOOD</Text></g>;
const Invoice=({x,y})=><g data-prop="annual-fee-invoice" transform={`translate(${x} ${y})`}><path d="M-175 -80 H175 V72 L150 80 L125 72 L100 80 L75 72 L50 80 L25 72 L0 80 L-25 72 L-50 80 L-75 72 L-100 80 L-125 72 L-150 80 L-175 72 Z" fill="white" stroke={K} strokeWidth="7"/><Text x={0} y={-8} size={52} width={310}>$200</Text><Text x={0} y={39} size={30} width={310}>ANNUAL FEE</Text></g>;
function PromiseIcon({index,x,y,active,pulse}){
 const scale=1+pulse*.12;
 return <g data-promise-icon={['rewards','interest','bonuses','zero-asterisk'][index]} data-topic-mentioned={String(active)} transform={`translate(${x} ${y}) scale(${scale})`}>
  <circle r="66" fill={active?['#fff5c7','#ffe7e5','#e4f3e7','#eeeeff'][index]:'white'} stroke={active?K:'#ccc'} strokeWidth="3"/>
  {index===0?<g stroke={K} strokeWidth="5" fill="#f4c542"><path d="M-28 -40 H28 V-9 Q28 18 0 22 Q-28 18 -28 -9 Z"/><path d="M-28 -29 H-45 Q-46 3 -22 3 M28 -29 H45 Q46 3 22 3" fill="none"/><path d="M0 22 V42 M-26 42 H26" fill="none"/></g>:index===1?<g><path d="M-43 43 Q-65 -50 -9 -49 Q58 -58 43 43 L20 30 L0 45 L-22 31 Z" fill={R} stroke={K} strokeWidth="4"/><circle cx="-17" cy="-13" r="8" fill="white"/><circle cx="17" cy="-13" r="8" fill="white"/><path d="M-20 17 L0 24 L20 17" fill="none" stroke="white" strokeWidth="5"/></g>:index===2?<PropIcon id="carrot" s={.49}/>:<g><rect x="-36" y="-48" width="72" height="101" rx="3" fill="white" stroke={K} strokeWidth="4"/><Text x={0} y={8} size={29} width={66}>0%*</Text><circle cx="25" cy="27" r="4" fill={K}/></g>}
  <Text x={0} y={91} size={23} width={220} fill={index===2?G:K}>{['REWARDS','INTEREST','BONUSES','0% + ASTERISK'][index]}</Text>
 </g>;
}
export function LongConsequencePerformance({ccsd,time,scene}){
 const timing=consequenceTiming(ccsd),cue=captionAtTime(ccsd?.caption_track,time);
 const audit=/^extension-audit-04/.test(scene?.id||'');
 const deletion=/^scene-13[2-9]$/.test(scene?.id||'');
 const mouth=id=>speechMouthActivity(id,time,cue);
 let art,headline,action;
 if(!audit&&!deletion){
  const p=feeConsequencePose(time,timing);action='fee_drop';headline=time>=timing.promise?'FOUR WAYS TO LOSE THE ADVANTAGE':'METAL CARD. REAL BILL.';
  art=p.phase==='promise'?<g data-consequence-phase="viewer-promise">
   <Dave x={640} y={497} s={.98} label="" mood="shock" leftHandTarget={{x:-105,y:-30}} rightHandTarget={{x:105,y:-30}} mouthOpen={mouth('dave')} gazeX={2}/>
   {p.iconsVisible&&[0,1,2,3].map(index=>{const angle=[-Math.PI*.75,-Math.PI*.25,Math.PI*.75,Math.PI*.25][index]+p.iconOrbit;return <PromiseIcon key={index} index={index} x={640+375*Math.cos(angle)} y={400+135*Math.sin(angle)} active={p.iconActive[index]} pulse={p.iconPulse[index]}/>;})}
  </g>:<g data-consequence-phase={p.phase}>
   <g data-causal-motion="invoice-crushes-dave" data-dave-squash={p.squashY}>
    {time>=timing.crawl?<g data-dave-recovery="crawl-then-stand">
     <Dave x={p.daveX} y={615-102*p.riseProgress-40*Math.sin(Math.PI*p.riseProgress)+p.crawlBob} s={.65+.23*p.riseProgress} lean={90*(1-p.riseProgress)} label="" mood="shock" leftHandTarget={{x:45-115*p.riseProgress,y:20}} rightHandTarget={{x:50+20*p.riseProgress,y:-135+155*p.riseProgress}} leftFootTarget={{x:-50,y:150}} rightFootTarget={{x:50,y:150}} mouthOpen={mouth('dave')} gazeX={3}/>
    </g>:<g transform={`translate(${p.daveX} 645) scale(${p.squashX} ${p.squashY}) translate(${-p.daveX} -645)`}>
     <Dave x={p.daveX} y={p.daveY} s={.88} label="" mood={time<timing.fall?'smile':'shock'} leftHandTarget={{x:-80,y:time<timing.impact?-70:25}} rightHandTarget={{x:80,y:time<timing.impact?-80:25}} mouthOpen={mouth('dave')} gazeY={-4}/>
    </g>}
    {p.invoiceVisible&&<Invoice x={p.invoiceX} y={p.invoiceY}/>}
    {p.impact>0&&<g opacity={p.impact} stroke={K} strokeWidth="5"><path d="M402 584 l-33 -19 M398 604 h-40 M798 584 l33 -19 M802 604 h40 M470 634 l-20 6 M730 634 l20 6"/></g>}
   </g>
   {time>=timing.crawl&&<PointsMonk x={1110} y={474} s={.97} label="" leftHandTarget={{x:-105,y:-42}} mouthOpen={mouth('points_monk')}/>}
   {p.titleVisible&&<g data-title-sting="0.9-seconds" transform={`translate(460 357) scale(${p.titleScale})`}><rect x="-340" y="-83" width="680" height="166" rx="8" fill={K}/><Text x={0} y={-18} size={37} width={640} fill="white">YOUR CREDIT CARD</Text><Text x={0} y={44} size={54} width={640} fill="white">HAS DLC</Text></g>}
  </g>;
 }else if(audit){
  const p=auditCartPose(time,timing);action='cart';headline='NORMAL SPENDING ONLY';
  art=<g data-consequence-phase="planned-cart-audit" data-ladder-in-cart="false">
   <Dave x={310} y={484} s={.98} label="" mood={p.ladderVisible?'mad':'smile'} rightHandTarget={{x:140+28*p.swat,y:-25-50*p.swat}} mouthOpen={mouth('dave')} gazeX={4}/>
   {p.groceriesVisible&&<Groceries x={600} y={437}/>}
   {p.gasVisible&&<g data-prop="planned-gas"><PropIcon id="gas_pump" x={711} y={427} s={.44}/></g>}
   <PropIcon id="shopping_cart" x={640} y={493} s={1.65}/>
   {p.checkVisible&&<g data-planned-cart-check="true"><path d="M566 258 l28 29 l55 -63" stroke={G} strokeWidth="10" fill="none" strokeLinecap="round"/><Text x={640} y={325} size={24} width={340} fill={G}>PLANNED PURCHASES</Text></g>}
   {p.ladderVisible&&<g data-causal-motion="uninvited-ladder-rejected"><Ladder x={p.ladderX} y={p.ladderY} angle={p.ladderAngle} scale={.84}/><path d={`M${p.ladderX-50} ${p.ladderY+84} l-13 9 M${p.ladderX+35} ${p.ladderY+84} l15 9`} stroke={K} strokeWidth="4" fill="none"/>{p.swat>0&&<path d="M815 365 l18 -20 M831 394 h28 M814 418 l19 19" stroke={K} strokeWidth="5"/>}</g>}
  </g>;
 }else{
  const p=deletionPose(time,timing);action='cart';headline=p.winning?'WINNING BACKWARDS':'SPEND $500 · GET $300';
  art=<g data-consequence-phase="delete-unneeded-purchases" data-cart-item-count={p.itemCount} data-deletion-count={p.deletionCount}>
   <Dave x={300} y={484} s={.98} label="" mood={p.ladderReturned?'shock':p.deletionCount>0?'mad':'deadpan'} rightHandTarget={{x:150,y:-15-152*p.press}} mouthOpen={mouth('dave')} gazeX={4}/>
   <PointsMonk x={1060} y={470} s={.98} label="" leftHandTarget={{x:-90,y:-40}} mouthOpen={mouth('points_monk')}/>
   <g data-delete-button="true" transform={`translate(452 ${314+5*p.press})`}><rect x="-79" y="-36" width="158" height="72" rx="10" fill={p.press>0?R:'white'} stroke={K} strokeWidth="5"/><Text x={0} y={9} size={27} width={142} fill={p.press>0?'white':K}>DELETE</Text></g>
   {p.extraVisible&&<g data-prop="unneeded-extra"><PropIcon id="reward_box" x={602} y={425} s={.62}/></g>}
   {p.ladderVisible&&<Ladder x={727} y={359} scale={p.ladderReturned?p.returnScale:1} angle={p.ladderReturned?-7:7}/>}
   <PropIcon id="shopping_cart" x={666} y={501} s={1.65}/>
   {p.puff>0&&<g data-deletion-feedback="removed" opacity={p.puff} stroke={R} strokeWidth="5" fill="none"><path d={p.deletionCount===1?'M575 401 l-25 -19 M626 396 l18 -25 M636 438 h28':'M690 331 l-27 -21 M755 324 l22 -25 M768 373 h30'}/></g>}
   <g><Text x={1030} y={270} size={42} width={240} fill={R}>−$200</Text><Text x={1030} y={306} size={22} width={240}>NET RESULT</Text></g>
   {p.deletionCount===3?<g data-final-cart-empty="true"><path d="M632 430 l24 24 l48 -56" stroke={G} strokeWidth="9" fill="none"/><Text x={666} y={250} size={24} width={490} fill={G}>EXTRA PURCHASES REMOVED</Text></g>:<Text x={666} y={250} size={24} width={490}>{p.itemCount} UNNEEDED {p.itemCount===1?'ITEM':'ITEMS'}</Text>}
  </g>;
 }
 return <g data-long-action={action} data-long-performance="consequence">
  <Text y={73} size={36}>{cue?.text||''}</Text><Text y={155}>{headline}</Text>
  <defs><clipPath id="long-consequence-art-safe"><rect x="100" y="200" width="1080" height="450"/></clipPath></defs>
  <g clipPath="url(#long-consequence-art-safe)">{art}<path d="M140 645 H1140" stroke={K} strokeWidth="3"/></g>
 </g>;
}
