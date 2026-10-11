// Conservative SVG text bounds use one em per glyph, avoiding truncation.
export function wrapText(value, maxColumns=24) {
  const words=String(value||'').trim().split(/\s+/).filter(Boolean), lines=[];
  for (const word of words) {
    const pieces=word.match(new RegExp(`.{1,${maxColumns}}`,'g'))||[];
    for (const piece of pieces) {
      if(lines.length && lines[lines.length-1].length+1+piece.length<=maxColumns) lines[lines.length-1]+=' '+piece;
      else lines.push(piece);
    }
  }
  return lines;
}
export function fitText(value,width=600,height=144,preferredSize=34) {
  for(let size=preferredSize;size>=14;size--) {
    const lines=wrapText(value,Math.floor(width/size));
    if(lines.length*size*1.2<=height) return {lines,size,lineHeight:size*1.2};
  }
  throw new Error('Text exceeds safe title region; shorten the scene copy');
}
export const normalizePropId=id=>id==='score_meter'?'score_gauge':id;
export const poseAliases={dave:{point:'hands_up_uncertain'},points_monk:{point:'deadpan_point',recoil:'ankle_yank'},cashback_goblin:{point:'sale_sign_point',recoil:'ankle_drag'}};
export const normalizePose=(character,pose)=>poseAliases[character]?.[pose]||pose;
export function characterSlots(count) {
  if(count>3) throw new Error('Studio stage supports at most three characters');
  return Array.from({length:count},(_,i)=>({x:360+(i-(count-1)/2)*(count===3?205:270),y:810,scale:count===1?1.18:count===2?.95:.78}));
}
export function propSlots(count) {
  if(count>4) throw new Error('Studio stage supports at most four props');
  return Array.from({length:count},(_,i)=>({x:360+(i-(count-1)/2)*(count<=2?230:145),y:440,scale:count<=2?.82:.54}));
}
export function v2BattleBeat(id) {
  return ['cold-open','chase-strike','amex-counter','fee-drain','points-summon','trap','final-clash','finish'].find(prefix=>String(id||'').startsWith(prefix+'-'))||null;
}
export function v2VictoryPose(progress) {
  // A deliberate hands-up celebration: raise, then three diminishing hops.
  const raise=Math.min(1,progress/.35);
  const hopPhase=Math.max(0,(progress-.35)/.65)*3;
  const hop=progress<.35?0:Math.abs(Math.sin(hopPhase*Math.PI))*(30-12*progress);
  return {bob:-hop,arm:28+raise*40,lean:0,leg:hop*.6,mood:'smile',leftHandTarget:{x:-66,y:-10-raise*80},rightHandTarget:{x:66,y:-10-raise*80}};
}
