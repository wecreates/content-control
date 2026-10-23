import React from 'react';
import {Dave} from './CharacterSystem';
import {PropIcon} from './PropSystem';
import {openingTiming,openingPose} from './LongOpeningMotion.mjs';
import {captionAtTime} from './ObservedCaptions.mjs';
import {speechMouthActivity} from './V2FacePerformance.mjs';
export const LongOpeningPerformance=({ccsd,time})=>{
 const timing=openingTiming(ccsd),p=openingPose(time,timing),cue=captionAtTime(ccsd.caption_track,time);
 const text=(content,y,size=32)=><text x="640" y={y} textAnchor="middle" fill="#111" fontFamily="Arial,sans-serif" fontWeight="800" fontSize={size}>{content}</text>;
 const table=(dent,top=510)=><g data-table-dent={dent}><path d={`M260 ${top} H500 Q545 ${top} 565 ${top+dent} Q640 ${top+dent} 715 ${top+dent} Q735 ${top} 780 ${top} H1020 V${top+26} H260 Z`} fill="#eee" stroke="#111" strokeWidth="6"/><path d={`M300 ${top+26} L280 650 M980 ${top+26} L1000 650`} stroke="#111" strokeWidth="9"/></g>;
 return <g data-long-action="card_slam" data-opening-shot={p.shot}>
  {text(cue?.text||'',73,36)}
  {text('METAL CARD. REAL BILL.',155)}
  {p.shot==='impact-closeup'?<g transform={`translate(${p.shake} ${p.shake*.3})`}>
   {table(p.dent)}
   <g data-causal-motion="hand-card-impact">
    <path d={`M165 245 Q310 240 420 ${p.cardY-82} L620 ${p.cardY-35}`} fill="none" stroke="#111" strokeWidth="18" strokeLinecap="round"/>
    <PropIcon id="card" x={640} y={p.cardY} s={1.35} rotation={p.cardAngle}/>
    <ellipse cx="620" cy={p.cardY-44} rx="34" ry="15" fill="white" stroke="#111" strokeWidth="6"/>
   </g>
   <g data-impact-response="table-deformation" opacity={p.impactOpacity} stroke="#111" strokeWidth="5" strokeLinecap="round"><path d="M480 470 l-42 -22 M480 493 l-55 0 M802 470 l42 -22 M802 493 l55 0 M590 575 l-15 28 M690 575 l15 28"/></g>
  </g>:p.shot==='hero-low-angle'?<g data-causal-motion="hero-card-lift">
   <path d="M330 640 H950" stroke="#111" strokeWidth="4"/>
   <g transform={`translate(640 460) scale(${1+.04*p.heroProgress}) translate(-640 -460)`}>
    <Dave x={570} y={435} s={1.35} lean={-4} rightHandTarget={{x:115,y:-108}} leftHandTarget={{x:-62,y:20}} leftFootTarget={{x:-68,y:150}} rightFootTarget={{x:72,y:150}} mood="smile" label="" gazeX={4} gazeY={-3} mouthOpen={speechMouthActivity('dave',time,cue)}/>
    <PropIcon id="card" x={715} y={278-18*p.heroProgress} s={.9} rotation={-18}/>
    <path d="M774 240 l15 -20 M790 262 l26 -2 M767 212 l-2 -23" stroke="#111" strokeWidth="4"/>
   </g>
  </g>:<g data-causal-motion="dangerous-reaction">
   <Dave x={430} y={435} s={1.2} rightHandTarget={{x:80,y:-50}} leftHandTarget={{x:-65,y:10}} mood="smile" label="" gazeX={3} browLift={4*p.reactionProgress} mouthOpen={speechMouthActivity('dave',time,cue)}/>
   {table(18,535)}
   <PropIcon id="card" x={640} y={472} s={1.05} rotation={0}/>
   <g transform={`translate(${Math.sin(time*20)*(time-timing.heroEnd<.25?4:0)} 0)`}>
    <rect x="690" y="285" width="410" height="112" rx="12" fill="#fff" stroke="#111" strokeWidth="5"/>
    <text x="895" y="329" textAnchor="middle" fill="#111" fontFamily="Arial,sans-serif" fontWeight="800" fontSize="27">FINANCIALLY</text><text x="895" y="365" textAnchor="middle" fill="#111" fontFamily="Arial,sans-serif" fontWeight="800" fontSize="27">DANGEROUS</text>
   </g>
   <g transform={`translate(${430+60*Math.cos(time*3)} ${329+30*Math.sin(time*3)})`} stroke="#111" strokeWidth="3"><path d="M-9 0 H9 M0 -9 V9"/></g>
  </g>}
 </g>;
};

