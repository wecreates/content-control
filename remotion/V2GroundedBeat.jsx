// Authored staging experiment: original actors/props, unchanged observed captions.
// Opt-in only. These are physical counter/door/table interactions, not a scale push.
import React from 'react';
import {Dave,PointsMonk} from './CharacterSystem.jsx';
import {Wallet,Sandwich,FeeJaw} from './V2BattleAction.jsx';
import {speechMouthActivity} from './V2FacePerformance.mjs';
import {groundedBeatState,localHand} from './V2GroundedLayout.mjs';
const K='#111',W='#fff';
const Line=({d,...props})=><path d={d} stroke={K} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}/>;
const Plate=({x,y,r=65})=><g><ellipse cx={x} cy={y} rx={r} ry="13" fill={W} stroke={K} strokeWidth="4"/><path d={`M${x-r+10} ${y+2}Q${x} ${y+17} ${x+r-10} ${y+2}`} fill="none" stroke={K} strokeWidth="2"/></g>;
const Counter=({x=45,y=890,width=630,bottom=1150})=><g data-grounded-surface="counter" stroke={K} strokeWidth="4" fill={W}><path d={`M${x} ${y}H${x+width}V${y+24}H${x}Z`}/><path d={`M${x+14} ${y+24}V${bottom}H${x+width-14}V${y+24}`}/><path d={`M${x+34} ${y+58}H${x+width-34}V${bottom-25}H${x+34}Z`} fill="none" strokeWidth="2"/></g>;
const Envelope=({x,y,s})=><g data-grounded-prop="fee-envelope" transform={`translate(${x} ${y}) scale(${s})`}><rect x="-78" y="-70" width="156" height="138" rx="8" fill={W} stroke={K} strokeWidth="5"/><Line d="M-78-70L0-8 78-70"/><text x="0" y="40" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="34" fill={K}>FEE</text></g>;
const Door=()=> <g data-grounded-setting="lounge-door"><Line d="M470 1100V415H678V1100M485 1100V430H665"/><path d="M496 447L647 490V1097L496 1060Z" fill={W} stroke={K} strokeWidth="4"/><circle cx="620" cy="787" r="6" stroke={K} strokeWidth="3" fill={W}/><Line d="M30 1100H690"/></g>;
const Actor=({id='dave',slot,left,right,time,observedCaption,mood='smile',gazeX=2})=>{
 const Character=id==='points_monk'?PointsMonk:Dave;
 return <Character x={slot.x} y={slot.y} s={slot.scale} label="" mood={mood} gazeX={gazeX} mouthOpen={speechMouthActivity(id,time,observedCaption)} leftHandTarget={localHand(slot,left)} rightHandTarget={localHand(slot,right)} leftFootTarget={{x:-48,y:150}} rightFootTarget={{x:48,y:150}}/>;
};
export function V2GroundedBeat({beat,progress,time,observedCaption}) {
 const g=groundedBeatState(beat,progress);if(!g)return null;
 if(beat==='fee-drain')return <g data-grounded-shot={g.shot}>
  <Line d="M40 1120H680"/>
  <defs><clipPath id="fee-actor-behind-counter"><rect x="0" y="350" width="720" height={g.surfaceY-350}/></clipPath></defs>
  <g clipPath="url(#fee-actor-behind-counter)"><Actor slot={g.actor} left={g.leftHand} right={g.walletGrip} time={time} observedCaption={observedCaption} mood="panic"/></g>
  <Counter y={g.surfaceY}/>
  <Plate x={g.snack.x} y={g.surfaceY-13}/><Sandwich x={g.snack.x} y={g.snack.y} s={g.snack.s}/>
  <Wallet {...g.wallet}/><FeeJaw {...g.jaw}/>
  <circle cx={g.walletGrip.x} cy={g.walletGrip.y} r="7" fill={W} stroke={K} strokeWidth="5"/>
 </g>;
 if(beat==='points-summon')return <g data-grounded-shot={g.shot}>
  <Door/>
  <Actor id="points_monk" slot={g.actor} left={g.leftHand} right={g.envelopeGrip} time={time} observedCaption={observedCaption} mood="deadpan"/>
  <Counter x={35} y={g.surfaceY} width={205} bottom={1095}/>
  <Plate x={135} y={g.surfaceY-13} r={77}/><Sandwich x={135} y={g.snack.y} s={g.snack.s}/>
  <text x="137" y={g.surfaceY+108} textAnchor="middle" fontFamily="Arial" fontWeight="800" fontSize="23" fill={K}>INVITED</text>
  <Envelope {...g.envelope}/><circle cx={g.envelopeGrip.x} cy={g.envelopeGrip.y} r="6" fill={W} stroke={K} strokeWidth="4"/>
 </g>;
 if(g.shot==='budget-table-detail')return <g data-grounded-shot={g.shot}>
  <rect data-grounded-surface="tabletop-insert" x="35" y="580" width="650" height="570" rx="18" fill={W} stroke={K} strokeWidth="4"/>
  <Line d="M53 600H667M53 1130H667" strokeWidth="2"/>
  <Plate x={g.snack.x} y={837} r={70}/><Sandwich {...g.snack}/>
  <Wallet {...g.wallet} label="BUDGET"/>
  {/* The insert shows Dave's hands resting on the table and pointing to the tiny snack. */}
  <Line d="M110 1070L135 955 170 858M590 1080L608 950 585 863" strokeWidth="11"/>
  <circle cx="170" cy="858" r="9" fill={W} stroke={K} strokeWidth="5"/><circle cx="585" cy="863" r="9" fill={W} stroke={K} strokeWidth="5"/>
 </g>;
 return <g data-grounded-shot={g.shot}>
  <Line d="M40 1150H680"/>
  <Actor slot={g.actor} left={g.leftHand} right={g.walletGrip} time={time} observedCaption={observedCaption} mood="smile"/>
  <Counter y={g.surfaceY}/>
  <Plate x={g.snack.x} y={g.surfaceY-13} r={54}/><Sandwich {...g.snack}/>
  <Wallet {...g.wallet} label="BUDGET"/>
  <path d="M85 883L170 860 226 884 140 907Z" fill={W} stroke={K} strokeWidth="3"/>
  <Line d="M115 883L165 872M128 892L178 880" strokeWidth="2"/>
  <circle cx={g.walletGrip.x} cy={g.walletGrip.y} r="7" fill={W} stroke={K} strokeWidth="4"/>
 </g>;
}
