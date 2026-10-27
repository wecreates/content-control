// Finale timing follows the observed speech, never an individual narration cut.
// The story beat remains the fallback when a preview has no caption track.
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
const ramp=(time,start,end)=>smooth((time-start)/Math.max(.001,end-start));
const montageLabel='FOUR RULES. FEWER TRAPS.';
const teaserLabel='NEXT: THE MINIMUM PAYMENT TRAP';
const label=scene=>scene?.visual?.label||scene?.text?.content||scene?.story?.beat||'';
export const matchesLongFinale=scene=>[montageLabel,teaserLabel].includes(label(scene));

export function finaleTiming(ccsd={}) {
 const scenes=ccsd.scenes||[];
 const montage=scenes.filter(scene=>label(scene)===montageLabel);
 const teaser=scenes.filter(scene=>label(scene)===teaserLabel);
 const ruleScene=number=>montage.find(scene=>(scene.audio?.dialogue||[]).some(line=>new RegExp(`^${number}:`,'i').test(line.text||'')));
 const anchors=['One','Two','Three','Four'].map(ruleScene);
 const starts=anchors.map((scene,index)=>scene?.start??[479.5833333333333,483.4166666666667,489.5,494.5416666666667][index]);
 const cues=ccsd.caption_track?.status==='PASS'&&ccsd.caption_track?.publication_enabled===false?ccsd.caption_track.cues||[]:[];
 const word=(anchor,regex,fallback,edge='start')=>{
  const cue=cues.find(c=>c.scene_id===anchor?.id&&regex.test(c.word||''));
  return Number.isFinite(cue?.[edge])?cue[edge]:fallback;
 };
 const teaserAnchor=teaser.find(scene=>scene.audio?.dialogue?.length)||teaser[0];
 const start=montage[0]?.start??476.625,end=montage.at(-1)?.end??498.75;
 const teaserStart=teaser[0]?.start??514.1666666666666;
 return {start,end,starts,
  rewardChange:word(anchors[0],/^actually\b/i,starts[0]+1.95),
  rewardUsed:word(anchors[0],/^use\b/i,starts[0]+2.86,'end'),
  compare:word(anchors[1],/^compare\b/i,starts[1]+.88),
  carry:word(anchors[1],/^carrying\b/i,starts[1]+3.54),
  wipe:word(anchors[1],/^wipe\b/i,starts[1]+4.36),
  stolen:word(anchors[1],/^reward\b/i,starts[1]+5.36,'end'),
  manufacture:word(anchors[2],/^manufactures\b/i,starts[2]+2.8),
  spending:word(anchors[2],/^spending\b/i,starts[2]+3.92,'end'),
  read:word(anchors[3],/^read\b/i,starts[3]+1.02),
  condition:word(anchors[3],/^condition\b/i,starts[3]+1.74,'end'),
  teaserStart,teaserEnd:teaser.at(-1)?.end??519.3333333333334,
  button:word(teaserAnchor,/^minimum\b/i,teaserStart+1.65),
  horror:word(teaserAnchor,/^horror\b/i,teaserStart+3.2533333333333)};
}

export function finalePose(time,timing) {
 const t=timing;
 if(time>=t.teaserStart&&time<t.teaserEnd){
  const button=ramp(time,t.button-.25,t.button+.45),eyes=ramp(time,t.horror,t.horror+.48);
  const danger=ramp(time,t.horror+.18,t.horror+.65),approach=ramp(time,t.horror+.35,t.teaserEnd);
  // The threat approaches after opening its eyes; reflected red light fills the hall.

  return {kind:'teaser',shot:'hallway-slow-push',button,eyes,approach,
   buttonY:495-28*button,tremble:Math.sin((time-t.horror)*31)*2.3*danger,
   push:1+.1*clamp((time-t.teaserStart)/(t.teaserEnd-t.teaserStart)),
   hallwayLight:1-.42*eyes};
 }
 if(time<t.start||time>=t.end)return {kind:'outside',shot:'outside'};
 if(time<t.starts[0])return {kind:'intro',shot:'four-rule-overview',reveal:[0,1,2,3].map(i=>ramp(time,t.start+.15+i*.5,t.start+.85+i*.65)),count:ramp(time,t.start+.3,t.starts[0]-.1)};
 if(time<t.starts[1]){
  const change=ramp(time,t.rewardChange,t.rewardUsed),cart=ramp(change,.35,.9);
  const sail=ramp(time,t.starts[0],t.rewardChange),push=55*ramp(time,t.rewardUsed,t.starts[1]-.05);
  return {kind:'rewards',shot:change<.45?'yacht-medium':'useful-reward-close',change,cart,sail,push,
   yachtX:645+60*sail,cartX:690+push,daveX:420+push,
   yachtScale:1-.93*ramp(change,0,.68),yachtOpacity:1-ramp(change,.55,.75),
   yachtY:370+68*change,coinY:310+106*ramp(change,.65,1),coinOpacity:ramp(change,.63,.78),
   daveHandX:535+25*sail+31*cart+push,daveHandY:400-27*cart};
 }
 if(time<t.starts[2]){
  const reach=ramp(time,t.carry,t.wipe),take=ramp(time,t.wipe,t.stolen),exchange=ramp(time,t.wipe+.1,t.stolen);
  const proudLift=35*(1-ramp(time,t.starts[1],t.compare+.15));
  return {kind:'interest',shot:time<t.carry?'reward-cost-comparison':'trophy-theft-close',reach,take,exchange,
   trophyX:510+270*take,trophyY:365-20*Math.sin(take*Math.PI)+proudLift,
   monsterHandX:820-310*reach+270*take,monsterHandY:425-25*Math.sin(take*Math.PI),
   invoiceX:780-270*exchange,invoiceY:365+35*exchange,
   daveHandX:510,daveHandY:425+35*exchange+proudLift,
   trophyOwner:take>0?'interest':'dave',receiptDelivered:exchange>=1};
 }
 if(time<t.starts[3]){
  const drop=ramp(time,t.manufacture,t.spending),impact=ramp(drop,.7,1);
  const advance=130*ramp(time,t.starts[2],t.manufacture),retreat=40*ramp(time,t.spending-.1,t.starts[3]-.05);
  return {kind:'bonus',shot:drop>0?'manufactured-spending-close':'bonus-cart-wide',drop,impact,advance,retreat,
   cartX:520+advance-retreat,daveX:300+advance-retreat,carrotX:687+60*advance/130,
   ladderY:322+95*drop,ladderOpacity:ramp(drop,0,.15),ladderAngle:-22+14*drop,
   cartY:510+8*impact,spendingVisible:ramp(drop,.65,.9),
   bonusRotation:-16+8*ramp(time,t.starts[2],t.manufacture),daveShock:drop>.35};
 }
 const inspect=ramp(time,t.read-.15,t.condition),reveal=ramp(time,t.read+.15,t.condition+.3);
 const down=ramp(time,t.condition+.05,t.condition+.65),across=ramp(time,t.condition+.35,t.condition+1.35),nextLine=ramp(time,t.condition+1.35,t.end-.08);
 const lensX=755-95*inspect-115*across+90*nextLine,lensY=340+75*inspect+50*down+32*nextLine;
 return {kind:'terms',shot:inspect<.45?'giant-zero-wide':'condition-magnifier-close',inspect,reveal,
  lensX,lensY,
  handX:lensX+92*.78,handY:lensY+92*.78};
}
