import React from "react";
const K="#111111",W="#FFFFFF",Y="#F4C542";
const elbowPoint=(x1,y1,x2,y2,bend=0,sign=1)=>{
  const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,len=Math.max(1,Math.hypot(dx,dy));
  return {x:mx+(-dy/len)*bend*sign,y:my+(dx/len)*bend*sign};
};
const kneePoint=(x1,y1,x2,y2,bend=0,sign=1)=>elbowPoint(x1,y1,x2,y2,bend,sign);

const DaveFace=({mood="smile"})=><g fill={K} stroke={K} strokeWidth="4" strokeLinecap="round">
  <circle cx="-11" cy="-10" r={mood==="shock"||mood==="panic"?5:4}/><circle cx="11" cy="-10" r={mood==="shock"||mood==="panic"?5:4}/>
  <path d="M-20 -22 Q-11 -27 -3 -20 M3 -20 Q11 -27 20 -22" fill="none"/>
  {mood==="shock"?<ellipse cy="10" rx="9" ry="12" fill="none"/>:
   mood==="panic"?<path d="M-14 12 Q0 24 14 12" fill="none"/>:
   mood==="mad"?<path d="M-14 13 Q0 0 14 13" fill="none"/>:
   mood==="deadpan"?<path d="M-12 8 L12 8" fill="none"/>:
   <path d="M-13 6 Q0 15 13 6" fill="none"/>}
</g>;

const MonkFace=({mood="deadpan"})=><g fill={K} stroke={K} strokeWidth="4" strokeLinecap="round">
  <path d="M-20 -12 L-4 -12 M4 -12 L20 -12" fill="none"/>
  <circle cx="-11" cy="-8" r="3"/><circle cx="11" cy="-8" r="3"/>
  {mood==="mad"&&<path d="M-22 -23 L-5 -18 M5 -18 L22 -23" fill="none"/>}
  {mood==="smile"?<path d="M-12 8 Q0 14 12 8" fill="none"/>:<path d="M-13 8 L13 8" fill="none"/>}
</g>;

const GoblinFace=({mood="smile"})=><g fill={K} stroke={K} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
  {mood==="coin"?<>
    <circle cx="-15" cy="-8" r="9" fill={Y}/><circle cx="15" cy="-8" r="9" fill={Y}/>
    <text x="-15" y="-4" textAnchor="middle" stroke="none" fill={K} fontFamily="Arial Black,Arial" fontSize="12">$</text>
    <text x="15" y="-4" textAnchor="middle" stroke="none" fill={K} fontFamily="Arial Black,Arial" fontSize="12">$</text>
  </>:<>
    <circle cx="-15" cy="-9" r={mood==="shock"?5:4}/><circle cx="15" cy="-9" r={mood==="shock"?5:4}/>
  </>}
  {mood==="shock"?<ellipse cy="12" rx="8" ry="10" fill="none"/>:
   <path d="M-21 7 Q0 28 21 7 Q0 19 -21 7" fill={W}/>}
</g>;

const HumanBase=({x,y,s=1,lean=0,mood="smile",label="",arm=0,leg=0,accent=K,headR=36,body=122,shoulders=66,kind="dave",armBend=18,legBend=12,leftHandTarget,rightHandTarget,leftFootTarget,rightFootTarget})=>{
  const lh=leftHandTarget||{x:-shoulders,y:-10-arm},rh=rightHandTarget||{x:shoulders,y:-10+arm};
  const lf=leftFootTarget||{x:-55,y:body+28+leg},rf=rightFootTarget||{x:55,y:body+28-leg};
  const le=elbowPoint(0,-10,lh.x,lh.y,armBend,-1),re=elbowPoint(0,-10,rh.x,rh.y,armBend,1);
  const lk=kneePoint(0,body-52,lf.x,lf.y,legBend,1),rk=kneePoint(0,body-52,rf.x,rf.y,legBend,-1);
  return <g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-88" r={headR} fill={W}/>
    <g transform="translate(0,-88)">{kind==="monk"?<MonkFace mood={mood}/>:<DaveFace mood={mood}/>}</g>
    <line y1="-52" y2={body-52}/>
    <line x1="0" y1="-10" x2={le.x} y2={le.y}/><line x1={le.x} y1={le.y} x2={lh.x} y2={lh.y}/>
    <line x1="0" y1="-10" x2={re.x} y2={re.y}/><line x1={re.x} y1={re.y} x2={rh.x} y2={rh.y}/>
    <line x1="0" y1={body-52} x2={lk.x} y2={lk.y}/><line x1={lk.x} y1={lk.y} x2={lf.x} y2={lf.y}/>
    <line x1="0" y1={body-52} x2={rk.x} y2={rk.y}/><line x1={rk.x} y1={rk.y} x2={rf.x} y2={rf.y}/>
    <circle cx={lh.x} cy={lh.y} r="5" fill={W}/><circle cx={rh.x} cy={rh.y} r="5" fill={W}/>
    {label&&<text y="-145" textAnchor="middle" fill={accent} stroke="none" fontFamily="Arial Black,Arial,sans-serif" fontSize="22">{label}</text>}
  </g>;
};

export const Dave=(props)=><HumanBase {...props} kind="dave" label={props.label??"DAVE"} mood={props.mood??"smile"} headR={36} body={122} shoulders={66}/>;

export const PointsMonk=(props)=><HumanBase {...props} kind="monk" label={props.label??"POINTS MONK"} mood={props.mood??"deadpan"} headR={34} body={136} shoulders={62}/>;

export const CashbackGoblin=({x,y,s=1,lean=0,mood="smile",label="",arm=0,leg=0,accent=Y,armBend=22,legBend=14,leftHandTarget,rightHandTarget})=>{
  const lh=leftHandTarget||{x:-48,y:5-arm},rh=rightHandTarget||{x:48,y:5+arm};
  const le=elbowPoint(0,15,lh.x,lh.y,armBend,-1),re=elbowPoint(0,15,rh.x,rh.y,armBend,1);
  const lf={x:-38,y:112+leg},rf={x:38,y:112-leg};
  const lk=kneePoint(0,60,lf.x,lf.y,legBend,1),rk=kneePoint(0,60,rf.x,rf.y,legBend,-1);
  return <g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-55" r="44" fill={W}/>
    <path d="M-38 -82 L-76 -103 L-60 -60 M38 -82 L76 -103 L60 -60" fill={W}/>
    <g transform="translate(0,-55)"><GoblinFace mood={mood}/></g>
    <line y1="-10" y2="60"/>
    <line x1="0" y1="15" x2={le.x} y2={le.y}/><line x1={le.x} y1={le.y} x2={lh.x} y2={lh.y}/>
    <line x1="0" y1="15" x2={re.x} y2={re.y}/><line x1={re.x} y1={re.y} x2={rh.x} y2={rh.y}/>
    <line x1="0" y1="60" x2={lk.x} y2={lk.y}/><line x1={lk.x} y1={lk.y} x2={lf.x} y2={lf.y}/>
    <line x1="0" y1="60" x2={rk.x} y2={rk.y}/><line x1={rk.x} y1={rk.y} x2={rf.x} y2={rf.y}/>
    {label&&<text y="-128" textAnchor="middle" fill={accent} stroke="none" fontFamily="Arial Black,Arial,sans-serif" fontSize="20">{label}</text>}
  </g>;
};

export const characterMotion={
  dave:{
    recoil:{lean:-12,arm:26,leg:10},
    frozen_mid_reach:{lean:4,arm:-22,leg:0},
    wallet_clutch:{lean:8,arm:34,leg:4},
    hands_up_uncertain:{lean:-2,arm:34,leg:2}
  },
  points_monk:{
    deadpan_point:{lean:0,arm:28,leg:0},
    door_kick:{lean:-14,arm:24,leg:34},
    calculator_drop:{lean:3,arm:-18,leg:0},
    ankle_yank:{lean:-8,arm:36,leg:8}
  },
  cashback_goblin:{
    coin_scamper:{lean:18,arm:30,leg:22},
    ankle_drag:{lean:-20,arm:36,leg:16},
    card_hug:{lean:0,arm:42,leg:0},
    sale_sign_point:{lean:12,arm:32,leg:10}
  }
};
