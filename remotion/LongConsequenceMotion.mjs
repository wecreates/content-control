// Physical events use observed word cues. Scene cuts select coverage only.
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
const word=value=>String(value??'').toLowerCase().replace(/[?.!,]/g,'');
const cueAt=(cues,source,needle,fallback,edge='start',occurrence=0)=>{
 const cue=cues.filter(c=>c.scene_id===source&&word(c.word)===needle)[occurrence];
 return Number.isFinite(cue?.[edge])?cue[edge]:fallback;
};
export function consequenceTiming(ccsd={}){
 const cues=ccsd.caption_track?.cues||[];
 const deletions=cues.filter(c=>c.scene_id==='scene-137'&&word(c.word)==='delete');
 return {
  feeStart:7.958333333333333,
  spent:cueAt(cues,'scene-132','spent',368.6366875),
  receive:cueAt(cues,'scene-132','receive',370.1166875),
  thisIs:cueAt(cues,'scene-135','this',372.68),
  promiseEnd:cueAt(cues,'scene-009','percent',27.6350625,'end'),
  debtEnd:cueAt(cues,'scene-007','debt',16.4,'end'),
  auditStart:169.625,auditEnd:179.375,
  auditCheckEnd:cueAt(cues,'extension-audit-04','cart',171.365,'end'),
  feeReveal:cueAt(cues,'scene-005','two-hundred-dollar',9.06),
  fall:cueAt(cues,'scene-005','falls',10.2),
  impact:cueAt(cues,'scene-005','ceiling',11.02),
  crawl:cueAt(cues,'scene-007','congratulations',12.9),
  rise:cueAt(cues,'scene-007','your',14.12),
  title:cueAt(cues,'scene-007','downloadable',15.2),
  promise:cueAt(cues,'scene-009','we’re',17.3750625),
  four:cueAt(cues,'scene-009','four',18.0950625),
  topics:[['rewards',22.5150625],['interest',23.2950625],['bonuses',23.9950625],['asterisk',25.9150625]].map(([label,fallback])=>cueAt(cues,'scene-009',label,fallback)),
  groceries:cueAt(cues,'extension-audit-04','groceries',172.425),
  gas:cueAt(cues,'extension-audit-04','gas',173.285),
  noLadder:cueAt(cues,'extension-audit-04','no',174.525),
  ladderAttempt:cueAt(cues,'extension-audit-04','ladder',176.385,'start',1),
  climb:cueAt(cues,'extension-audit-04','climb',177.205),
  swat:cueAt(cues,'extension-audit-04','aboard',177.425),
  winning:cueAt(cues,'scene-135','backwards',373.62),
  deletes:[375.333375,375.993375,377.493375].map((fallback,i)=>Number.isFinite(deletions[i]?.start)?deletions[i].start:fallback),
  ladderQuestion:cueAt(cues,'scene-137','ladder',377.033375),
 };
}
export function feeConsequencePose(time,t){
 const fall=clamp((time-t.fall)/Math.max(.1,t.impact-t.fall));
 const crush=smooth((time-t.impact)/.13);
 const crawl=smooth((time-t.crawl)/Math.max(.2,t.rise-t.crawl));
 const rise=smooth((time-t.rise)/.75);
 const departure=smooth((time-t.rise)/.9);
 const approach=smooth((time-t.feeStart)/(t.feeReveal-t.feeStart));
 const push=smooth((time-t.impact-.2)/(t.crawl-t.impact-.2));
 const reset=smooth((time-t.debtEnd)/(t.promise-t.debtEnd));
 const phase=time<t.impact?'falling':time<t.crawl?'flattened':time<t.rise?'crawling':time<t.promise?'recovered':'promise';
 return {phase,invoiceVisible:time>=t.feeReveal&&time<t.title,
  invoiceY:285+245*fall*fall,invoiceX:600+65*push-735*departure,
  invoiceAngle:-9*push*(1-smooth((time-t.crawl)/.45)),
  brace:approach,walkStep:Math.sin(Math.PI*2*approach),resetStep:Math.sin(Math.PI*2*reset),push,
  squashY:1-.87*crush*(1-rise),squashX:1+.4*crush*(1-rise),
  daveX:500+100*approach+265*crawl-225*reset,daveY:513,riseProgress:rise,
  crawlBob:time>=t.crawl&&time<t.rise?Math.sin((time-t.crawl)*16)*2:0,
  impact:time>=t.impact&&time<t.impact+.26?1-(time-t.impact)/.26:0,
  titleVisible:time>=t.title&&time<t.title+.9,
  titleScale:.86+.14*smooth((time-t.title)/.09),
  iconsVisible:time>=t.four,
  iconOrbit:Math.sin((time-t.four)*.45)*.11,
  promiseOutro:smooth((time-t.promiseEnd)/(28.708333333333332-t.promiseEnd)),
  iconActive:t.topics.map(start=>time>=start),
  iconPulse:t.topics.map(start=>time>=start&&time<start+.34?Math.sin((time-start)/.34*Math.PI):0),
 };
}
export function deletionPose(time,t){
 const [one,two,three]=t.deletes;
 const extraVisible=time<one,secondExtraVisible=time<two,ladderVisible=time<three;
 const last=[one,two,three].filter(start=>time>=start).at(-1);
 const press=last===undefined?0:Math.max(0,1-(time-last)/.25);
 const read=smooth((time-t.spent)/(t.receive-t.spent));
 const reckon=smooth((time-t.receive)/(t.thisIs-t.receive));
 const retreat=smooth((time-t.thisIs)/(t.winning+.5-t.thisIs));
 const prepare=smooth((time-(t.winning+.5))/(one-t.winning-.5));
 const onward=smooth((time-three)/(378.75-three));
 const daveX=300+100*read-100*reckon-55*retreat+55*prepare+105*onward;
 return {extraVisible,secondExtraVisible,ladderVisible,
  itemCount:Number(extraVisible)+Number(secondExtraVisible)+Number(ladderVisible),press,
  deletionCount:t.deletes.filter(start=>time>=start).length,
  puff:press,winning:time>=t.winning,
  daveX,cartOffset:105*onward,walkStep:Math.sin(Math.PI*2*(read+reckon+retreat+prepare+onward)),
  receiptVisible:time<one,receiptX:daveX+165,receiptY:300+45*Math.sin(Math.PI*reckon),
  receiptAngle:-9+18*reckon-9*retreat,receiptScale:1-.35*prepare,
  compareGesture:smooth((time-t.receive)/1.25),onward,
 };
}
export function auditCartPose(time,t){
 const approaching=smooth((time-t.ladderAttempt)/Math.max(.2,t.climb-t.ladderAttempt));
 const climbing=smooth((time-t.climb)/Math.max(.15,t.swat-t.climb));
 const rejected=smooth((time-t.swat)/.42);
 const arrival=smooth((time-t.auditStart)/(t.auditCheckEnd-t.auditStart));
 const onward=smooth((time-(t.swat+.55))/(t.auditEnd-t.swat-.55));
 return {groceriesVisible:time>=t.groceries,gasVisible:time>=t.gas,
  ladderVisible:time>=t.ladderAttempt,ladderInCart:false,
  ladderX:1040-190*approaching-45*climbing+155*rejected+135*onward,
  ladderY:510-105*climbing+75*rejected,
  ladderAngle:-12-18*climbing+48*rejected-15*onward,
  cartOffset:-80+80*arrival-105*onward,walkStep:Math.sin(Math.PI*2*(arrival+onward)),
  inspection:Math.sin(Math.PI*arrival),onward,
  listVisible:time>=t.auditCheckEnd-.35,listLift:smooth((time-(t.auditCheckEnd-.35))/(t.groceries-t.auditCheckEnd+.35)),
  swat:time>=t.swat&&time<t.swat+.3?Math.sin((time-t.swat)/.3*Math.PI):0,
  checkVisible:time>=t.noLadder};
}
export function matchesLongConsequence(scene){
 return /^scene-(00[5-9]|01[0-2]|13[2-9])$/.test(scene?.id||'')||/^extension-audit-04(?:-cut-\d+)?$/.test(scene?.id||'');
}
