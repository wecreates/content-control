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
