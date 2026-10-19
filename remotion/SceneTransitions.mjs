const clamp=v=>Math.max(0,Math.min(1,v));
export const transitionStyle=(transition,localFrame,totalFrames,isOut=false)=>{
  const frames=Math.max(1,transition?.frames||6);
  const p=isOut?clamp((localFrame-(totalFrames-frames))/frames):clamp(localFrame/frames);
  const q=isOut?p:1-p;
  const type=transition?.type||"cut";
  if(type==="object_wipe"||type==="foreground_wipe") return {clipPath:`inset(0 ${q*100}% 0 0)`};
  if(type==="whip_pan") return {transform:`translateX(${q*110}%)`};
  if(type==="zoom_through") return {transform:`scale(${1+q*1.7})`,opacity:1-q*.7};
  if(type==="coin_iris") return {clipPath:`circle(${(1-q)*75}% at 50% 50%)`};
  if(type==="prop_collision") return {transform:`translateY(${q*-28}px) rotate(${q*3}deg)`};
  return {};
};
