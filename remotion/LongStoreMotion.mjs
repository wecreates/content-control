// Physical state is keyed to the observed dialogue, never to the two-second scene cuts.
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const p=clamp(x);return p*p*(3-2*p);};
const mix=(a,b,p)=>a+(b-a)*p;
const span=(time,start,end)=>smooth((time-start)/Math.max(.001,end-start));
const word=(ccsd,sceneId,pattern,fallback,edge='start')=>{
 const cue=ccsd?.caption_track?.cues?.find(c=>c.scene_id===sceneId&&pattern.test(c.word||''));
 return Number.isFinite(cue?.[edge])?cue[edge]:fallback;
};
const sceneStart=(ccsd,id,fallback)=>ccsd?.scenes?.find(s=>s.id===id)?.start??fallback;
export const matchesLongStore=scene=>/Store shelf:|Math floats physically:|Big red label SAVED|Dave returns object;|red invoice inches from|Interest monster strolls in|interest invoices duplicate/i.test(scene?.story?.visual_gag||'');
export const longStoreTiming=ccsd=>({
 start:sceneStart(ccsd,'scene-041',90.0833333333),
 walk:word(ccsd,'scene-044',/^walks$/i,96),
 find:word(ccsd,'scene-044',/^Finds$/i,98.48),
 price:word(ccsd,'scene-044',/^fifteen-dollar$/i,99.24),
 grasp:word(ccsd,'scene-044',/^object$/i,99.54),
 credit:word(ccsd,'scene-047',/^ten\.?$/i,102.88),
 pay:word(ccsd,'scene-047',/^five\.?$/i,103.6),
 stamp:word(ccsd,'scene-050',/^negative$/i,107.3),
 return:word(ccsd,'scene-053',/^Back$/i,109.98),
 shelf:word(ccsd,'scene-053',/^shelf$/i,110.54),
 returned:word(ccsd,'scene-053',/^goes\.?$/i,111.28,'end'),
 end:sceneStart(ccsd,'scene-056',112.375),
});
export const longStorePose=(time,t)=>{
 const walking=span(time,t.walk,t.find),reach=span(time,t.find,t.grasp);
 const pickup=span(time,t.grasp,t.grasp+.72),returning=span(time,t.return,t.shelf);
 const shelfPull=span(time,t.shelf,t.returned-.14),recoil=span(time,t.stamp,t.stamp+.18)*(1-span(time,t.stamp+.18,t.stamp+.75));
 let daveX=mix(285,675,walking)-175*pickup-12*recoil;
 let objectX=mix(865,650,pickup)-12*recoil,objectY=mix(422,430,pickup);
 if(time>=t.return){daveX=mix(500,655,returning);objectX=mix(650,805,returning);objectY=mix(430,407,returning);}
 if(time>=t.shelf){objectX=mix(805,865,shelfPull);objectY=mix(407,422,shelfPull);}
 const owns=time>=t.grasp&&time<t.shelf;
 const handX=owns?objectX-40:time<t.grasp?mix(daveX+60,825,reach):mix(765,daveX+62,span(time,t.shelf,t.returned));
 const handY=owns?objectY+15:time<t.grasp?mix(470,437,reach):mix(422,473,span(time,t.shelf,t.returned));
 const walletOpen=span(time,t.pay-.2,t.pay+.12),moth=span(time,t.pay+.12,t.pay+1.25);
 return {shot:time<t.find?'shelf-wide':time<t.grasp+.72?'product-pickup':time<t.return?'wallet-medium':'shelf-return',
  daveX,daveY:480,daveLean:-8*recoil,handX,handY,objectX,objectY,
  objectOwner:time<t.grasp?'shelf':time<t.shelf?'dave':shelfPull<1?'shelf-hand':'shelf',
  gait:time>=t.walk&&time<t.find?Math.sin((time-t.walk)*10)*15*Math.sin(walking*Math.PI):0,
  priceVisible:time>=t.price,creditProgress:span(time,t.credit,t.credit+.22),payProgress:span(time,t.pay,t.pay+.22),
  walletOpen,mothX:daveX-70-95*moth,mothY:440-115*moth,mothVisible:time>=t.pay+.12&&time<t.pay+1.65,
  stampProgress:span(time,t.stamp-.14,t.stamp),stampOpacity:span(time,t.stamp-.14,t.stamp)*(1-span(time,t.return-.25,t.return)),
  shelfHand:span(time,t.shelf-.3,t.shelf)*(1-span(time,t.returned,t.returned+.25)),
  scoreProgress:span(time,t.returned,t.end-.08),
  cameraScale:1+.12*span(time,t.grasp+.72,t.grasp+1.2)*(1-span(time,t.return-.4,t.return)),
  cameraOffsetY:-16*span(time,t.grasp+.72,t.grasp+1.2)*(1-span(time,t.return-.4,t.return)),
 };
};
export const longTrophyTiming=ccsd=>({
 start:sceneStart(ccsd,'scene-083',287.3333333333),
 nervous:word(ccsd,'scene-085',/^nervous\.?$/i,293.16),
 enter:word(ccsd,'scene-088',/^Interest$/i,294.9),
 arrived:word(ccsd,'scene-088',/^in\.?$/i,295.94,'end'),
 reach:word(ccsd,'scene-088',/^Takes$/i,296.1),
 take:word(ccsd,'scene-088',/^trophy\.?$/i,296.48),
 taken:word(ccsd,'scene-088',/^trophy\.?$/i,296.82,'end'),
 leave:word(ccsd,'scene-088',/^Leaves$/i,297.04),
 invoice:word(ccsd,'scene-088',/^invoice\.?$/i,297.8,'end'),
 rewards:word(ccsd,'scene-090',/^Rewards$/i,299.38),
 once:word(ccsd,'scene-090',/^once\.?$/i,300.46),
 billing:word(ccsd,'scene-090',/^billing\.?$/i,302.18),
 end:sceneStart(ccsd,'scene-095',309.4166666667),
});
export const longTrophyPose=(time,t)=>{
 const enter=span(time,t.enter,t.arrived),take=span(time,t.take,t.taken),handoff=span(time,t.leave,t.invoice),exit=span(time,t.invoice+.15,t.rewards-.35);
 const monsterX=mix(1140,875,enter)+265*exit;
 const nervous=time>=t.nervous&&time<t.take?Math.sin((time-t.nervous)*25)*2.5:0;
 const trophyX=mix(550,755,take)+265*exit+nervous,trophyY=mix(380,275,take);
 return {shot:time<t.enter?'trophy-close':time<t.rewards?'trophy-exchange':'invoice-mechanism',
  monsterX,monsterY:390,monsterOpacity:span(time,t.enter,t.enter+.16)*(1-span(time,t.rewards-.6,t.rewards-.12)),
  monsterGait:time>=t.enter&&time<t.arrived?Math.sin((time-t.enter)*12)*13:time>t.invoice+.15&&time<t.rewards-.35?Math.sin((time-t.invoice)*12)*13:0,
  trophyX,trophyY,trophyOwner:time<t.take?'dave':'interest',trophyVisible:time<t.rewards,
  invoiceX:mix(725,550,handoff),invoiceY:mix(mix(390,460,take),400,handoff),invoiceOwner:time<t.enter?'comparison':time<t.invoice?'interest':'dave',
  handX:550,handY:time<t.take?460:mix(460,466,span(time,t.take,t.taken)),
  monsterTrophyHandX:time<t.take?mix(monsterX-70,615,span(time,t.reach,t.take)):trophyX+65,
  monsterTrophyHandY:time<t.take?mix(415,355,span(time,t.reach,t.take)):trophyY-25,
  monsterInvoiceHandX:time<t.invoice?mix(777.5,595,handoff):mix(595,monsterX+75,span(time,t.invoice,t.invoice+.15)),
  monsterInvoiceHandY:mix(mix(390,460,take),400,handoff),
  copies:time<t.billing?0:Math.min(4,1+Math.floor((time-t.billing)/.48)),
  rewardVisible:time>=t.rewards,rewardProgress:span(time,t.rewards,t.once),
  invoiceProgress:handoff,
  cameraScale:1+.18*(1-span(time,t.enter-.5,t.enter)),cameraOffsetY:-30*(1-span(time,t.enter-.5,t.enter)),
 };
};

// New bills physically peel out of the original invoice; there is no loop or reset.
export const longInvoiceCopyPose=(index,time,t)=>{
 const progress=span(time,t.billing+index*.48,t.billing+index*.48+.42);
 return {x:mix(550,672+index*77,progress),y:mix(400,405-index*16,progress),progress};
};
