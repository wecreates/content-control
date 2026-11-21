const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=v=>{const p=clamp(v);return p*p*(3-2*p);};
export const localHand=(slot,point)=>({x:(point.x-slot.x)/slot.scale,y:(point.y-slot.y)/slot.scale});
// Layout coordinates are authored per shot: tabletop contact and readable action
// take precedence over reusing the former stage's floating symbolic positions.
export function groundedBeatState(beat,progress) {
 const p=clamp(progress);
 if(beat==='fee-drain'){
  const detail=p>=.5,surfaceY=detail?970:900;
  const wallet={x:detail?365:340,y:detail?770:735,s:detail?1.1:.9,rotation:0};
  const attack=smooth((p-.14)/.54),actor=detail?{x:165,y:865,scale:2}:{x:170,y:800,scale:1.7};
  return {shot:detail?'fee-wallet-detail':'fee-counter-establish',surfaceY,actor,wallet,
   walletGrip:{x:wallet.x-45*wallet.s,y:wallet.y+66*wallet.s},leftHand:{x:detail?80:70,y:detail?920:875},
   jaw:{x:wallet.x+230-120*attack,y:wallet.y,open:.15+.85*Math.abs(Math.sin(p*Math.PI*2)),s:detail?.95:.8},
   snack:{x:560,y:surfaceY-13-32*.64,s:.64}};
 }
 if(beat==='points-summon'){
  const receive=smooth((p-.08)/.58),surfaceY=925,actor={x:335,y:845,scale:1.7};
  const envelope={x:620-110*receive,y:680+55*receive,s:.82};
  return {shot:receive<.5?'invitation-arrival':'invitation-received',surfaceY,actor,envelope,
   envelopeGrip:{x:envelope.x-78*envelope.s,y:envelope.y+12*envelope.s},leftHand:{x:230,y:900},
   snack:{x:135,y:surfaceY-13-32*.92,s:.92}};
 }
 if(beat==='finish'){
  if(p>=.51&&p<.84)return {shot:'budget-table-detail',wallet:{x:270,y:850-66*1.22,s:1.22,rotation:0},snack:{x:570,y:837-32*.4,s:.4}};
  const surfaceY=900,wallet={x:435,y:surfaceY-66*.94,s:.94,rotation:0},actor={x:220,y:785,scale:1.85};
  return {shot:p<.51?'budget-choice':'budget-reaction',surfaceY,actor,wallet,walletGrip:{x:wallet.x-110*wallet.s,y:wallet.y},leftHand:{x:170,y:866},snack:{x:600,y:surfaceY-13-32*.4,s:.4}};
 }
 return null;
}
