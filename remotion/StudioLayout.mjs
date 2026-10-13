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
function originalV2SceneActor(beat,id,index,count) {
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
// Enlarge the performers into the unused lower stage while retaining each
// prop contact in world coordinates. Scaling only the rig previously moved
// hands off wallets/shields; captions and prop geometry stay independent.
export function v2SceneActor(beat,id,index,count) {
 const original=originalV2SceneActor(beat,id,index,count);
 const staging={
  'cold-open':{y:730,scale:1.5},
  'chase-strike':{x:575,y:770,scale:1.35},
  'fee-drain':{y:770,scale:1.35},
  'points-summon':{y:800,scale:1.4},
  'trap':{y:830,scale:1.4},
  'finish':{y:840,scale:1.5},
  'final-clash':{y:760,scale:1.3},
  'amex-counter':id==='cashback_goblin'?{y:790,scale:1.3}:{y:735,scale:1.35},
 }[beat];
 if(!staging)return original;
 const slot={...original,...staging};
 for(const key of ['leftHandTarget','rightHandTarget'])if(original[key]){
  slot[key]={x:(original.x+original.scale*original[key].x-slot.x)/slot.scale,
             y:(original.y+original.scale*original[key].y-slot.y)/slot.scale};
 }
 return slot;
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

// World-anchored contacts compensate body movement; free gestures follow the rig.
export function resolveBattleHandTargets(motion,slot,{freeGesture=false}={}) {
 if(freeGesture)return {leftHandTarget:motion.leftHandTarget,rightHandTarget:motion.rightHandTarget};
 const angle=(motion.lean||0)*Math.PI/180;
 const contact=target=>{
  if(!target)return undefined;
  const y=target.y-(motion.bob||0)/slot.scale;
  return {x:target.x*Math.cos(angle)+y*Math.sin(angle),y:-target.x*Math.sin(angle)+y*Math.cos(angle)};
 };
 return {leftHandTarget:contact(slot.leftHandTarget),rightHandTarget:contact(slot.rightHandTarget)};
}

// Reach the actual button before the wallet spills; return to the grip afterward.
export function v2TrapTapHand(progress,grip) {
 const ease=value=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p);};
 const reach=ease((progress-.02)/.10)*(1-ease((progress-.17)/.15));
 return {x:grip.x+(210-grip.x)*reach,y:grip.y+(423-grip.y)*reach};
}

// One transform owns both the cape artwork and the hand gripping its lower hem.
export function v2CapeMotion(progress) {
 const p=Math.max(0,Math.min(1,progress)),q=p*p*(3-2*p);
 return {x:360-q*140,y:452,s:1.05,rotation:-q*18};
}
export function v2CapeGrip(progress) {
 const cape=v2CapeMotion(progress),a=cape.rotation*Math.PI/180;
 // The central hem vertex is local (0,95) in the Cape SVG path.
 return {x:cape.x-cape.s*95*Math.sin(a),y:cape.y+cape.s*95*Math.cos(a)};
}
