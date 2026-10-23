import React from 'react';
import {Dave,PointsMonk} from './CharacterSystem';
import {PropIcon} from './PropSystem';
import {captionAtTime} from './ObservedCaptions.mjs';
import {speechMouthActivity} from './V2FacePerformance.mjs';
import {longStoreTiming,longStorePose,longTrophyTiming,longTrophyPose,longInvoiceCopyPose} from './LongStoreMotion.mjs';
export {matchesLongStore} from './LongStoreMotion.mjs';
const K='#111111',W='#FFFFFF',Y='#F4C542',R='#D8342C',T='#168F8F';
const Txt=({children,x=640,y=155,size=30,fill=K,width=1120,...rest})=><text x={x} y={y} textAnchor="middle" stroke="none" fill={fill} fontFamily="Arial,sans-serif" fontWeight="800" fontSize={Math.min(size,width/Math.max(1,String(children??'').length*.64))} {...rest}>{children}</text>;
const toLocal=(x,y,cx,cy,scale=1,lean=0)=>{const a=-lean*Math.PI/180,dx=(x-cx)/scale,dy=(y-cy)/scale;return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};};
const Novelty=({x,y,owner,angle=0})=><g transform={`translate(${x} ${y}) rotate(${angle})`} data-novelty-object="one-continuous-prop" data-owner={owner} stroke={K} strokeWidth="4" strokeLinejoin="round">
 <ellipse cy="-3" rx="39" ry="32" fill="#F4F4F4"/><path d="M-26 -29 L-30 -62 L-9 -47 L0 -70 L12 -47 L29 -62 L25 -28 Z" fill={Y}/><circle cx="-12" cy="-5" r="7" fill={W}/><circle cx="12" cy="-5" r="7" fill={W}/><circle cx="-11" cy="-4" r="2" fill={K}/><circle cx="13" cy="-4" r="2" fill={K}/><path d="M-9 15 Q0 20 9 15" fill="none"/><path d="M-18 26 V36 H18 V26 M-47 36 H47 V58 H-47 Z" fill={W}/><Txt x={0} y={52} size={11}>DELUXE ROCK</Txt>
 <path d="M38 12 L63 29" fill="none" strokeWidth="2"/><rect x="48" y="22" width="56" height="34" rx="5" fill={W}/><Txt x={76} y={46} size={21}>$15</Txt>
</g>;
const Invoice=({x,y,s=.75,ghost=false,index=0,angle=0})=><g transform={`translate(${x} ${y}) rotate(${angle} 0 66) scale(${s})`} data-invoice={ghost?'repeat':'original'} data-invoice-index={index}>
 <PropIcon id="receipt"/><rect x="-55" y="-65" width="110" height="135" fill={W}/><Txt x={0} y={-35} size={20} fill={R}>INTEREST</Txt><Txt x={0} y={6} size={30} fill={R}>$19.73</Txt><path d="M-43 28 H43 M-43 45 H25" stroke={R} strokeWidth="4"/><Txt x={0} y={-109} size={17} fill={R}>{ghost&&index<4?'BILL AGAIN':''}</Txt>
</g>;
const Trophy=({x,y,showLabel=true})=><g transform={`translate(${x} ${y})`} data-trophy="single-reward" stroke={K} strokeWidth="5" strokeLinejoin="round">
 <path d="M-54 -48 H-79 V-14 Q-79 12 -47 12 M54 -48 H79 V-14 Q79 12 47 12" fill="none"/><path d="M-59 -66 H59 L47 -6 Q35 24 0 24 Q-35 24 -47 -6 Z" fill={Y}/><path d="M0 24 V58 M-38 61 H38 V80 H-38 Z" fill={Y}/><Txt x={0} y={-17} size={32}>$20</Txt>{showLabel&&<Txt x={0} y={108} size={18}>REWARD</Txt>}
</g>;
const Interest=({p})=><g data-interest-monster="physical-prop-exchange" opacity={p.monsterOpacity} stroke={K} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
 <path d={`M${p.monsterX-65} 410 Q${p.monsterX-125} 390 ${p.monsterTrophyHandX} ${p.monsterTrophyHandY}`} fill="none"/><path d={`M${p.monsterX+70} 410 Q${p.monsterX+120} 430 ${p.monsterInvoiceHandX} ${p.monsterInvoiceHandY}`} fill="none"/>
 <path d={`M${p.monsterX-35} 485 l${-18+p.monsterGait} 100 h-26 M${p.monsterX+35} 485 l${18-p.monsterGait} 100 h26`} fill="none"/>
 <g transform={`translate(${p.monsterX} ${p.monsterY})`}><path d="M-92 90 Q-123 -102 -18 -118 Q102 -124 97 80 L53 65 L3 99 L-40 68 Z" fill={K}/><ellipse cx="-32" cy="-35" rx="12" ry="14" fill={W}/><ellipse cx="30" cy="-35" rx="12" ry="14" fill={W}/><path d="M-32 14 H32" stroke={W} strokeWidth="5"/><Txt x={0} y={55} size={21} fill={W}>INTEREST</Txt></g>
 <circle cx={p.monsterTrophyHandX} cy={p.monsterTrophyHandY} r="7" fill={W}/><circle cx={p.monsterInvoiceHandX} cy={p.monsterInvoiceHandY} r="7" fill={W}/>
</g>;
const StoreArt=({ccsd,time,cue})=>{
 const t=longStoreTiming(ccsd),p=longStorePose(time,t),s=1;
 const walletX=p.daveX-68,walletY=p.walletY;
 return <g data-store-shot={p.shot} data-object-owner={p.objectOwner} transform={`translate(640 ${450+p.cameraOffsetY}) scale(${p.cameraScale}) translate(-640 -450)`}>
  <path d="M175 638 H1170" stroke={K} strokeWidth="3"/>
  <g data-store-shelf="true"><path d="M750 480 H1000 V497 H750 Z M770 497 V632 M980 497 V632" fill="#F3F3F3" stroke={K} strokeWidth="5"/><path d="M770 555 H980" fill="none" stroke={K} strokeWidth="4"/><Txt x={875} y={599} size={20}>WANTS DEPARTMENT</Txt></g>
  {time<t.grasp&&<g data-coupon-laser="10-off" opacity={time<t.find?.7:1}>
   <path d={`M${p.daveX+61} ${p.phoneY+11} L865 365`} stroke={T} strokeWidth="3" strokeDasharray="9 7"/><path d="M827 309 l-10 -21 M865 295 v-25 M903 309 l10 -21" stroke={Y} strokeWidth="5" strokeLinecap="round"/>
   <g transform={`rotate(${p.couponAngle} 946 285)`}><rect x="946" y="285" width="160" height="62" rx="11" fill={Y} stroke={K} strokeWidth="4"/><Txt x={1026} y={326} size={30}>$10 OFF</Txt></g>
  </g>}
  <Dave x={p.daveX} y={p.daveY} s={s} lean={p.daveLean} label="" mood={time>=t.stamp&&time<t.return?'shock':'smile'} gazeX={4} gazeY={-1} browLift={time>=t.stamp&&time<t.return?4:0}
   rightHandTarget={toLocal(p.handX,p.handY,p.daveX,p.daveY,s,p.daveLean)} leftHandTarget={time>=t.grasp?toLocal(walletX+20,walletY,p.daveX,p.daveY,s,p.daveLean):toLocal(p.daveX+52,p.phoneY,p.daveX,p.daveY,s,p.daveLean)}
   leftFootTarget={toLocal(p.daveX-48-p.gait,630-Math.max(0,p.gait),p.daveX,p.daveY,s,p.daveLean)} rightFootTarget={toLocal(p.daveX+48+p.gait,630-Math.max(0,-p.gait),p.daveX,p.daveY,s,p.daveLean)} mouthOpen={speechMouthActivity('dave',time,cue)}/>
  {time<t.grasp?<PropIcon id="phone" x={p.daveX+52} y={p.phoneY} s={.46} rotation={p.phoneAngle}/>:<g transform={`rotate(${p.walletAngle} ${walletX} ${walletY})`} data-wallet-state={p.walletOpen>.5?'open-empty':'closed'}>
   <PropIcon id="wallet" x={walletX} y={walletY} s={.43}/><g transform={`translate(${walletX} ${walletY-18}) scale(.43) rotate(${-55*p.walletOpen} -85 0)`}><path d="M-85 0 V-36 Q0 -50 85 -36 V0 Z" fill={W} stroke={K} strokeWidth="5"/></g>
   {p.walletOpen>.1&&<ellipse cx={walletX} cy={walletY-16} rx={31*p.walletOpen} ry="7" fill={K}/>}
  </g>}
  {p.mothVisible&&<g data-wallet-moth="escaped" transform={`translate(${p.mothX} ${p.mothY}) rotate(-20)`} stroke={K} strokeWidth="2" fill="#DDD"><ellipse cx="-8" rx={8+4*Math.sin(time*55)**2} ry="8"/><ellipse cx="8" rx={8+4*Math.sin(time*55)**2} ry="8"/><path d="M0 -8 V10 M-4 -9 l-5 -5 M4 -9 l5 -5"/></g>}
  <g opacity={p.shelfHand} data-shelf-return-hand="true"><path d={`M990 492 V443 Q982 421 ${p.objectX+42} ${p.objectY+13}`} fill="none" stroke={K} strokeWidth="7" strokeLinecap="round"/><circle cx={p.objectX+42} cy={p.objectY+13} r="10" fill={W} stroke={K} strokeWidth="4"/></g>
  <Novelty x={p.objectX} y={p.objectY} owner={p.objectOwner} angle={p.objectAngle}/>
  {p.priceVisible&&time<t.return&&<g data-cost-equation="true"><rect x="632" y="260" width="414" height="77" rx="12" fill={W} stroke={K} strokeWidth="4"/><Txt x={695} y={311} size={35}>$15</Txt><g opacity={p.creditProgress}><Txt x={755} y={311} size={34}>−</Txt><Txt x={819} y={311} size={35}>$10</Txt></g><g opacity={p.payProgress}><Txt x={882} y={311} size={34}>=</Txt><Txt x={960} y={311} size={35} fill={R}>$5</Txt></g></g>}
  <PointsMonk x={1090} y={480} s={.9} label="" lean={p.monkLean} gazeX={-3} leftHandTarget={{x:-58-37*p.monkPoint,y:15-105*p.monkPoint}} mouthOpen={speechMouthActivity('points_monk',time,cue)}/>
  <g data-savings-stamp="negative-five" opacity={p.stampOpacity} transform={`translate(400 304) rotate(${-5*p.stampProgress}) scale(${1+.15*(1-p.stampProgress)})`}><rect x="-165" y="-44" width="330" height="88" rx="8" fill={W} stroke={R} strokeWidth="7"/><Txt x={0} y={14} size={43} fill={R}>SAVED −$5</Txt></g>
  <g opacity={p.scoreProgress} data-next-scoreboard="forming"><g transform={`translate(${p.scoreboardX} 0)`}><rect x="-220" y="250" width="440" height="75" rx="9" fill={W} stroke={K} strokeWidth="4"/><Txt x={0} y={296} size={24}>REWARDS + CREDITS − FEE</Txt></g></g>
 </g>;
};
const TrophyArt=({ccsd,time,cue})=>{
 const t=longTrophyTiming(ccsd),p=longTrophyPose(time,t);
 return <g data-trophy-shot={p.shot} data-trophy-owner={p.trophyOwner} data-invoice-owner={p.invoiceOwner} transform={`translate(640 ${450+p.cameraOffsetY}) scale(${p.cameraScale}) translate(-640 -450)`}>
  <path d="M175 638 H1170" stroke={K} strokeWidth="3"/>
  {p.rewardVisible&&<g data-one-time-reward="one" opacity={p.rewardProgress}><PropIcon id="coin" x={315} y={265} s={.5}/><Txt x={315} y={314} size={23}>$20 · ONCE</Txt></g>}
  <Dave x={400} y={480} s={1} lean={p.daveLean} label="" mood={time>=t.take?'shock':time>=t.nervous?'panic':'smile'} gazeX={4} gazeY={-2} rightHandTarget={toLocal(p.handX,p.handY,400,480,1,p.daveLean)} leftHandTarget={{x:-58,y:17}} leftFootTarget={toLocal(345,630,400,480,1,p.daveLean)} rightFootTarget={toLocal(455,630,400,480,1,p.daveLean)} mouthOpen={speechMouthActivity('dave',time,cue)}/>
  <Interest p={p}/>
  {Array.from({length:p.copies},(_,i)=>{const q=longInvoiceCopyPose(i,time,t);return <g key={i} data-invoice-emission={q.progress}><Invoice x={q.x} y={q.y} s={.65} ghost index={i+1}/></g>;})}
  {p.trophyVisible&&<g opacity={time<t.enter?1:time<t.rewards-.6?1:p.monsterOpacity}><Trophy x={p.trophyX} y={p.trophyY} showLabel={p.trophyOwner==='dave'}/></g>}
  <Invoice x={p.invoiceX} y={p.invoiceY} s={.75} angle={p.invoiceAngle}/>
  {time>=t.rewards&&<><PointsMonk x={1090} y={480} s={.9} label="" lean={p.monkLean} gazeX={-3} leftHandTarget={{x:-100-16*p.monkGesture,y:-90+35*p.monkGesture}} rightHandTarget={{x:65+12*p.monkGesture,y:10-30*p.monkGesture}} mouthOpen={speechMouthActivity('points_monk',time,cue)}/><Txt x={799} y={244} size={25}>{time>=t.billing?'BORROWING KEEPS BILLING':'REWARDS PAY ONCE'}</Txt></>}
 </g>;
};
export const LongStorePerformance=({ccsd,time,scene})=>{
 const cue=captionAtTime(ccsd?.caption_track,time),isTrophy=/invoice|trophy/i.test(scene?.story?.visual_gag||'');
 return <g data-long-action={isTrophy?'trophy_invoice':'store_return'}>
  <Txt y={73} size={36}>{cue?.text||''}</Txt><Txt y={155} size={32}>{scene?.visual?.label||scene?.story?.beat||''}</Txt>
  {isTrophy?<TrophyArt ccsd={ccsd} time={time} cue={cue}/>:<StoreArt ccsd={ccsd} time={time} cue={cue}/>}
 </g>;
};
