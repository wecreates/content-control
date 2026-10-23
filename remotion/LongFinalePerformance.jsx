import React from 'react';
import {Dave,PointsMonk} from './CharacterSystem';
import {PropIcon} from './PropSystem';
import {captionAtTime} from './ObservedCaptions.mjs';
import {speechMouthActivity} from './V2FacePerformance.mjs';
import {finaleTiming,finalePose,matchesLongFinale} from './LongFinaleMotion.mjs';
export {matchesLongFinale};
const K='#111111',W='#FFFFFF',Y='#F4C542',R='#D8342C',T='#117F79';
const Text=({children,x=640,y=155,size=30,width=1100,fill=K,...rest})=><text x={x} y={y} textAnchor="middle" fill={fill} stroke="none" fontFamily="Arial,sans-serif" fontWeight="800" fontSize={Math.min(size,width/Math.max(1,String(children??'').length*.68))} {...rest}>{children}</text>;
const Trophy=({x,y,s=1,rotation=0,labelY=108})=><g data-story-prop="reward-trophy" transform={`translate(${x} ${y}) scale(${s}) rotate(${rotation})`} stroke={K} strokeWidth="5" strokeLinejoin="round">
 <path d="M-54 -48 H-79 V-14 Q-79 12 -47 12 M54 -48 H79 V-14 Q79 12 47 12" fill="none"/><path d="M-59 -66 H59 L47 -6 Q35 24 0 24 Q-35 24 -47 -6 Z" fill={Y}/><path d="M0 24 V58 M-38 61 H38 V80 H-38 Z" fill={Y}/><Text x={0} y={-17} size={32}>$20</Text><Text x={0} y={labelY} size={18}>REWARD</Text>
</g>;
// The interest prop uses the production silhouette; approved humans are unchanged.
const Interest=({x,y,s=1,opacity=1})=><g data-story-prop="interest-monster" transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
 <path d="M-92 90 Q-123 -102 -18 -118 Q102 -124 97 80 L53 65 L3 99 L-40 68 Z" fill={K} stroke={K} strokeWidth="5"/>
 <ellipse cx="-32" cy="-35" rx="12" ry="14" fill={W}/><ellipse cx="30" cy="-35" rx="12" ry="14" fill={W}/><path d="M-32 14 H32" stroke={W} strokeWidth="5"/><Text x={0} y={55} size={21} fill={W}>INTEREST</Text>
</g>;
const Yacht=({x,y,s=1,opacity=1})=><g data-story-prop="yacht" transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity} stroke={K} strokeWidth="5" strokeLinejoin="round">
 <path d="M-135 34 H140 L98 81 H-95 Z" fill={W}/><path d="M-35 34 V-65 L105 27 H-25 M-47 -50 L-115 25 H-47 Z" fill={W}/><path d="M-150 96 Q-125 83 -100 96 T-50 96 T0 96 T50 96 T100 96 T150 96" fill="none"/>
</g>;
const Invoice=({x,y,scale=1})=><g data-story-prop="interest-invoice" transform={`translate(${x} ${y}) scale(${scale})`}>
 <PropIcon id="receipt"/><rect x="-55" y="-65" width="110" height="135" fill={W}/><Text x={0} y={-35} size={20} fill={R}>INTEREST</Text><Text x={0} y={6} size={30} fill={R}>$19.73</Text><path d="M-43 28 H43 M-43 45 H25" stroke={R} strokeWidth="4"/>
</g>;
const RuleBadge=({n,title})=><g data-rule-number={n}><circle cx="142" cy="240" r="25" fill={K}/><Text x={142} y={249} size={24} fill={W}>{n}</Text><text x="185" y="249" fill={K} fontFamily="Arial,sans-serif" fontWeight="800" fontSize="24">{title}</text></g>;
const cameraTransform=scale=>`translate(640 420) scale(${scale}) translate(-640 -420)`;
const Floor=()=> <path d="M140 637 H1140" stroke={K} strokeWidth="3"/>;
const Presenter=({time,cue,x=1060,y=480,s=.92,hand})=><PointsMonk x={x} y={y} s={s} label="" mood="deadpan" gazeX={-3} leftHandTarget={hand||{x:-100,y:-80}} rightHandTarget={{x:55,y:20}} mouthOpen={speechMouthActivity('points_monk',time,cue)}/>;

const Overview=({p,time,cue})=><g data-causal-motion="four-rule-recap">
 <Dave x={170} y={485} s={.9} label="" rightHandTarget={{x:68,y:-75}} gazeX={3} mood="smile" mouthOpen={speechMouthActivity('dave',time,cue)}/>
 {[0,1,2,3].map((i)=><g key={i} transform={`translate(${360+i*185} ${400+25*(1-p.reveal[i])})`} opacity={p.reveal[i]}>
  <rect x="-78" y="-92" width="156" height="205" rx="16" fill={W} stroke={K} strokeWidth="4"/>
  <circle cx="-53" cy="-67" r="18" fill={K}/><Text x={-53} y={-60} size={19} fill={W}>{i+1}</Text>
  {i===0?<Trophy x={0} y={-4} s={.57}/>:i===1?<Interest x={0} y={5} s={.4}/>:i===2?<PropIcon id="carrot" x={0} y={8} s={.44}/>:<Text x={0} y={29} size={55}>0%*</Text>}
  <Text x={0} y={89} size={17} width={136}>{['USE IT','CHECK COST','NO EXTRAS','READ TERMS'][i]}</Text>
 </g>)}
 <Presenter time={time} cue={cue} x={1118} s={.78}/><Floor/>
</g>;

const RewardRule=({p,time,cue})=><g transform={cameraTransform(1+.035*p.cart)} data-causal-motion="yacht-to-useful-cart" data-reward-state={p.cart>=1?'usable-reward':'expectation-to-reality'}>
 <RuleBadge n={1} title="COUNT WHAT YOU WILL USE"/>
 <Dave x={420} y={470} s={1.02} label="" mood={p.change>.5?'smile':'shock'} gazeX={3} rightHandTarget={{x:(p.daveHandX-420)/1.02,y:(p.daveHandY-470)/1.02}} leftHandTarget={{x:-55,y:35}} mouthOpen={speechMouthActivity('dave',time,cue)}/>
 <Yacht x={705} y={p.yachtY} s={p.yachtScale} opacity={p.yachtOpacity}/>
 <g opacity={p.cart} data-reward-cart="true" transform={`translate(690 430) scale(${.72+.38*p.cart})`}><PropIcon id="shopping_cart"/><g opacity={p.coinOpacity}><PropIcon id="reward_box" x={6} y={-30} s={.34}/></g></g>
 <g opacity={p.coinOpacity}><PropIcon id="coin" x={710} y={p.coinY} s={.32}/></g>
 <g opacity={1-p.change}><Text x={705} y={303} size={28} width={420}>30,000 POINTS</Text></g>
 <g opacity={p.cart}><rect x="601" y="529" width="208" height="58" rx="10" fill={Y} stroke={K} strokeWidth="4"/><Text x={705} y={567} size={28}>$210 TO USE</Text></g>
 <Presenter time={time} cue={cue}/><Floor/>
</g>;

const InterestRule=({p,time,cue})=><g transform={cameraTransform(1+.035*p.reach)} data-causal-motion="interest-trophy-theft" data-trophy-owner={p.trophyOwner} data-receipt-delivered={String(p.receiptDelivered)}>
 <RuleBadge n={2} title="COMPARE COSTS WITH REWARDS"/>
 <Dave x={340} y={470} s={1} label="" mood={p.take>.1?'shock':'smile'} gazeX={3} rightHandTarget={{x:p.daveHandX-340,y:p.daveHandY-470}} leftHandTarget={{x:-55,y:20}} mouthOpen={speechMouthActivity('dave',time,cue)}/>
 <path d={`M866 415 Q800 464 ${p.monsterHandX} ${p.monsterHandY}`} fill="none" stroke={K} strokeWidth="15" strokeLinecap="round"/>
 <path d="M877 494 L859 576 H835 M932 494 L950 576 H974" fill="none" stroke={K} strokeWidth="6" strokeLinecap="round"/>
 <Invoice x={p.invoiceX} y={p.invoiceY} scale={.85}/>
 <Interest x={904} y={436} s={.8}/>
 <Trophy x={p.trophyX} y={p.trophyY} s={.82} rotation={-8*Math.sin(p.take*Math.PI)} labelY={108+30*p.take}/>
 <circle cx={p.monsterHandX} cy={p.monsterHandY} r="8" fill={W} stroke={K} strokeWidth="4"/>
 <g opacity={1-p.reach}><Text x={780} y={282} size={20}>BORROWING COST</Text><Text x={640} y={425} size={28}>vs.</Text></g>
 <g opacity={p.take}><Text x={640} y={610} size={28} fill={R}>DEBT CAN TAKE THE REWARD</Text></g>
 <Presenter time={time} cue={cue} x={1130} s={.76} hand={{x:-65,y:-55}}/><Floor/>
</g>;

const BonusRule=({p,time,cue})=><g transform={cameraTransform(1+.025*p.impact)} data-causal-motion="bonus-manufactures-spending" data-extra-item={p.drop>0?'ladder-entering':'absent'}>
 <RuleBadge n={3} title="A BONUS IS NOT AUTOMATIC PROFIT"/>
 <path d="M880 290 Q810 275 757 306" fill="none" stroke={K} strokeWidth="4"/>
 <PropIcon id="carrot" x={747} y={345} s={.48} rotation={p.bonusRotation}/><Text x={918} y={314} size={27} width={260}>+$300 BONUS</Text>
 <Dave x={430} y={495} s={.95} label="" mood={p.daveShock?'shock':'smile'} gazeX={3} rightHandTarget={{x:(650-90*1.15-430)/.95,y:(p.cartY-52*1.15-495)/.95}} leftHandTarget={{x:-60,y:16}} mouthOpen={speechMouthActivity('dave',time,cue)}/>
 <g data-story-prop="decorative-ladder" opacity={p.ladderOpacity} transform={`translate(650 ${p.ladderY}) rotate(${p.ladderAngle})`} stroke={K} strokeWidth="6" strokeLinecap="round"><path d="M-36 -76 V76 M36 -76 V76 M-36 -48 H36 M-36 -8 H36 M-36 32 H36 M-36 65 H36" fill="none"/></g>
 <PropIcon id="shopping_cart" x={650} y={p.cartY} s={1.15}/>
 <g opacity={p.spendingVisible}><path d="M805 390 H1005 V498 L985 486 L965 498 L945 486 L925 498 L905 486 L885 498 L865 486 L845 498 L825 486 L805 498 Z" fill={W} stroke={K} strokeWidth="4"/><Text x={905} y={432} size={30} fill={R}>−$500</Text><Text x={905} y={470} size={23} width={176}>EXTRA SPENDING</Text><Text x={905} y={552} size={24} width={300} fill={R}>$300 − $500 = −$200</Text></g>
 <Presenter time={time} cue={cue} x={1125} s={.78} hand={{x:-65,y:-45}}/><Floor/>
</g>;

const TermsRule=({p,time,cue})=><g transform={cameraTransform(1+.025*p.inspect)} data-causal-motion="read-beside-giant-zero" data-condition-revealed={p.reveal>=1?'true':'false'}>
 <RuleBadge n={4} title="READ THE CONDITION BESIDE THE ZERO"/>
 <rect x="442" y="285" width="276" height="311" rx="8" fill={W} stroke={K} strokeWidth="5"/>
 <Text x={568} y={397} size={100} width={240}>0%</Text><Text x={680} y={342} size={51}>*</Text>
 <path d="M474 451 H684 M474 477 H660 M474 503 H678" fill="none" stroke={K} strokeWidth="5"/>
 <Text x={580} y={555} size={20} width={230}>CONDITIONS APPLY</Text>
 <Presenter time={time} cue={cue} x={245} s={.95} hand={{x:100,y:-75}}/>
 <Dave x={900} y={520} s={.8} label="" gazeX={-3} gazeY={2} mood="deadpan" leftHandTarget={{x:(p.handX-900)/.8,y:(p.handY-520)/.8}} rightHandTarget={{x:60,y:10}} mouthOpen={speechMouthActivity('dave',time,cue)}/>
 <PropIcon id="magnifying_glass" x={p.lensX} y={p.lensY} s={.78}/>
 <g opacity={p.reveal} data-condition-detail="true">
  <path d="M704 395 L775 335" fill="none" stroke={K} strokeWidth="3"/>
  <rect x="775" y="278" width="345" height="135" rx="12" fill={W} stroke={K} strokeWidth="4"/>
  <Text x={947.5} y={315} size={23} width={318}>PROMO END DATE</Text><Text x={947.5} y={351} size={23} width={318}>PAYMENT CONDITIONS</Text><Text x={947.5} y={386} size={20} width={318} fill={T}>READ THE FULL TERMS</Text>
 </g><Floor/>
</g>;

const HorrorTeaser=({p})=><g data-causal-motion="eyes-trigger-button-tremble" data-eye-openness={p.eyes} data-button-revealed={p.button>=1?'true':'false'}>
 <defs><clipPath id="long-finale-hallway-safe"><rect x="80" y="200" width="1120" height="450"/></clipPath><radialGradient id="long-finale-eye-glow"><stop offset="0" stopColor="#ff4a47" stopOpacity=".58"/><stop offset="1" stopColor="#e72931" stopOpacity="0"/></radialGradient></defs>
 <g clipPath="url(#long-finale-hallway-safe)">
  <g transform={`translate(640 425) scale(${p.push}) translate(-640 -425)`}>
   <rect x="80" y="200" width="1120" height="450" fill="#111521"/>
   <path d="M80 200 L480 287 H800 L1200 200 M80 650 L480 555 H800 L1200 650 M480 287 V555 M800 287 V555" fill="none" stroke="#6E7483" strokeWidth="3" opacity={p.hallwayLight}/>
   <path d="M80 200 L480 287 V555 L80 650 Z M1200 200 L800 287 V555 L1200 650 Z" fill="#1C2230"/>
   {[0,1,2].map(i=><g key={i} stroke="#5D6473" strokeWidth={4-i} fill="none" opacity={p.hallwayLight}><path d={`M${176+i*101} ${225+i*22} V${625-i*24} M${1104-i*101} ${225+i*22} V${625-i*24}`}/><path d={`M${190+i*100} ${235+i*22} V${615-i*24} M${1090-i*100} ${235+i*22} V${615-i*24}`}/></g>)}
   <path d="M480 555 L80 650 H1200 L800 555 Z" fill="#252734"/>
   <path d="M570 555 L420 650 M710 555 L860 650 M380 580 H900 M240 617 H1040" fill="none" stroke="#414450" strokeWidth="2"/>
   <rect x="491" y="281" width="298" height="284" rx="2" fill="#03040A" stroke="#777A84" strokeWidth="4"/>
   <path d="M510 218 H770 L735 240 H545 Z" fill="#C2C4CD" opacity={.55*p.hallwayLight}/>
   <g data-red-eyes="true" opacity={p.eyes}>
    {[568,712].map(x=><g key={x}><ellipse cx={x} cy="356" rx="75" ry="62" fill="url(#long-finale-eye-glow)"/><ellipse cx={x} cy="356" rx="30" ry={1+17*p.eyes} fill="#FF383D"/><path d={`M${x-27} 339 L${x+25} 350`} stroke="#06060B" strokeWidth="7"/><ellipse cx={x} cy="359" rx="5" ry={12*p.eyes} fill="#190208"/></g>)}
   </g>
   <g transform={`translate(${640+p.tremble} ${p.buttonY})`} opacity={p.button} data-minimum-payment-button="true">
    <ellipse cy="97" rx="192" ry="19" fill="#03040A"/>
    <path d="M-155 20 L-177 86 H177 L155 20 Z" fill="#1D1B25" stroke="#74717C" strokeWidth="3"/>
    <rect x="-174" y="-43" width="348" height="90" rx="18" fill="#3F1721" stroke="#DA484B" strokeWidth="4"/>
    <rect x="-161" y="-34" width="322" height="66" rx="12" fill="#6B2430"/>
    <Text x={0} y={-4} size={27} fill={W} width={300}>MINIMUM</Text><Text x={0} y={26} size={27} fill={W} width={300}>PAYMENT</Text>
   </g>
  </g>
 </g>
</g>;

export function LongFinalePerformance({ccsd,time,scene}) {
 if(!matchesLongFinale(scene))return null;
 const p=finalePose(time,finaleTiming(ccsd)),cue=captionAtTime(ccsd?.caption_track,time),dark=p.kind==='teaser';
 const headline=scene.visual?.label||scene.text?.content||scene.story?.beat;
 return <g data-long-action={dark?'minimum-payment-horror':'four-rule-montage'} data-finale-shot={p.shot}>
  {dark&&<rect width="1280" height="720" fill="#090C16"/>}
  <Text y={73} size={36} fill={dark?W:K} data-observed-caption="true">{cue?.text||''}</Text>
  <Text y={155} size={32} fill={dark?W:K} data-finale-headline="true">{headline}</Text>
  <g data-art-safe-region="200–650">
   {p.kind==='intro'?<Overview p={p} time={time} cue={cue}/>:p.kind==='rewards'?<RewardRule p={p} time={time} cue={cue}/>:p.kind==='interest'?<InterestRule p={p} time={time} cue={cue}/>:p.kind==='bonus'?<BonusRule p={p} time={time} cue={cue}/>:p.kind==='terms'?<TermsRule p={p} time={time} cue={cue}/>:dark?<HorrorTeaser p={p}/>:null}
  </g>
 </g>;
}
