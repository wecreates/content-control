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
export function v2SceneActor(beat,id,index,count) {
  const slots={
    'cold-open':{x:190,y:680,scale:1.1,rightHandTarget:{x:78,y:-110},mood:'shock'},
    'chase-strike':{x:600,y:715,scale:1,leftHandTarget:{x:-72,y:-155},mood:'deadpan'},
    'fee-drain':{x:155,y:710,scale:1,rightHandTarget:{x:90,y:-145},mood:'panic'},
    'points-summon':{x:360,y:745,scale:1,leftHandTarget:{x:-100,y:-140},rightHandTarget:{x:110,y:-150},mood:'deadpan'},
    'trap':{x:360,y:755,scale:1,leftHandTarget:{x:-55,y:-184},rightHandTarget:{x:55,y:-184},mood:'shock'},
    'finish':{x:360,y:770,scale:1.05,leftHandTarget:{x:-60,y:-130},rightHandTarget:{x:60,y:-130},mood:'smile'},
  };
  if(beat==='amex-counter')return id==='cashback_goblin'?{x:190,y:730,scale:.95,rightHandTarget:{x:35,y:-165},mood:'smile'}:{x:540,y:660,scale:1,leftHandTarget:{x:-67,y:-158},mood:'deadpan'};
  if(beat==='final-clash')return index===0?{x:185,y:650,scale:.95,rightHandTarget:{x:85,y:-140},mood:'smile'}:{x:535,y:650,scale:.95,leftHandTarget:{x:-85,y:-140},mood:'smile'};
  return slots[beat]||characterSlots(count)[index];
}
export function captionTextWidth(text,size) {
  // Deliberately overestimate Arial Bold advances; reserve padding separately.
  return [...String(text)].reduce((sum,c)=>sum+(/[MW@#%&mw]/.test(c)?1:/[ilI1.,'!:;|]/.test(c)?.4:/\s/.test(c)?.38:/[A-Z0-9]/.test(c)?.78:.66),0)*size;
}
export function fitCaption(text,width=592,height=175,preferredSize=34) {
 const words=String(text||'').trim().split(/\s+/).filter(Boolean),usable=width-48;
 for(let size=preferredSize;size>=14;size--){
  const lines=[];
  for(const word of words){
   const last=lines.length-1;
   if(last>=0&&captionTextWidth(lines[last]+' '+word,size)<=usable)lines[last]+=' '+word;
   else lines.push(word);
  }
  if(lines.every(line=>captionTextWidth(line,size)<=usable)&&lines.length*size*1.2<=height)return {lines,size,lineHeight:size*1.2};
 }
 throw new Error('Caption exceeds safe text region');
}
