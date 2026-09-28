import React from "react";
const K="#111111",W="#FFFFFF";
const pt=(x,y)=>({x,y});
const limb=(a,b)=><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>;
const bend=(a,b,c)=><>{limb(a,b)}{limb(b,c)}<circle cx={b.x} cy={b.y} r="4" fill={K} stroke="none"/></>;

export const solveTwoBoneIK=(root,target,l1,l2,bendSign=1)=>{
  const dx=target.x-root.x,dy=target.y-root.y,d=Math.max(.001,Math.min(l1+l2-.001,Math.hypot(dx,dy)));
  const base=Math.atan2(dy,dx);
  const c=(l1*l1+d*d-l2*l2)/(2*l1*d);
  const ang=Math.acos(Math.max(-1,Math.min(1,c)))*bendSign;
  const joint=pt(root.x+Math.cos(base+ang)*l1,root.y+Math.sin(base+ang)*l1);
  return {joint,end:target};
};

export const ArticulatedCharacter=({x=0,y=0,s=1,lean=0,headR=36,body=122,shoulder=58,hip=26,
  leftHand,rightHand,leftFoot,rightFoot,face=null,accent=K})=>{
  const neck=pt(0,-52),chest=pt(0,12),pelvis=pt(0,body-52);
  const ls=pt(-shoulder,0),rs=pt(shoulder,0),lh=pt(-hip,body-48),rh=pt(hip,body-48);
  const lht=leftHand||pt(-92,18),rht=rightHand||pt(92,18),lft=leftFoot||pt(-58,body+30),rft=rightFoot||pt(58,body+30);
  const la=solveTwoBoneIK(ls,lht,48,48,-1),ra=solveTwoBoneIK(rs,rht,48,48,1);
  const ll=solveTwoBoneIK(lh,lft,52,58,1),rl=solveTwoBoneIK(rh,rft,52,58,-1);
  return <g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-88" r={headR} fill={W}/>{face?<g transform="translate(0,-88)">{face}</g>:null}
    <line x1={neck.x} y1={neck.y} x2={chest.x} y2={chest.y}/><line x1={chest.x} y1={chest.y} x2={pelvis.x} y2={pelvis.y}/>
    {bend(ls,la.joint,la.end)}{bend(rs,ra.joint,ra.end)}{bend(lh,ll.joint,ll.end)}{bend(rh,rl.joint,rl.end)}
    <circle cx={lht.x} cy={lht.y} r="7" fill={W}/><circle cx={rht.x} cy={rht.y} r="7" fill={W}/>
    <line x1={lft.x-8} y1={lft.y} x2={lft.x+10} y2={lft.y}/><line x1={rft.x-8} y1={rft.y} x2={rft.x+10} y2={rft.y}/>
  </g>;
};