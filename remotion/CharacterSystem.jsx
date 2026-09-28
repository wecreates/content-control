import React from "react";
const K="#111111",W="#FFFFFF",Y="#F4C542";

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

const HumanBase=({x,y,s=1,lean=0,mood="smile",label="",arm=0,leg=0,accent=K,headR=36,body=122,shoulders=66,kind="dave"})=>
<g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
  <circle cy="-88" r={headR} fill={W}/>
  <g transform="translate(0,-88)">{kind==="monk"?<MonkFace mood={mood}/>:<DaveFace mood={mood}/>}</g>
  <line y1="-52" y2={body-52}/>
  <line x1="0" y1="-10" x2={-shoulders} y2={-10-arm}/><line x1="0" y1="-10" x2={shoulders} y2={-10+arm}/>
  <line x1="0" y1={body-52} x2={-55} y2={body+28+leg}/><line x1="0" y1={body-52} x2={55} y2={body+28-leg}/>
  {label&&<text y="-145" textAnchor="middle" fill={accent} stroke="none" fontFamily="Arial Black,Arial,sans-serif" fontSize="22">{label}</text>}
</g>;

export const Dave=(props)=><HumanBase {...props} kind="dave" label={props.label??"DAVE"} mood={props.mood??"smile"} headR={36} body={122} shoulders={66}/>;

export const PointsMonk=(props)=><HumanBase {...props} kind="monk" label={props.label??"POINTS MONK"} mood={props.mood??"deadpan"} headR={34} body={136} shoulders={62}/>;

export const CashbackGoblin=({x,y,s=1,lean=0,mood="smile",label="",arm=0,leg=0,accent=Y})=>
  <g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-55" r="44" fill={W}/>
    <path d="M-38 -82 L-76 -103 L-60 -60 M38 -82 L76 -103 L60 -60" fill={W}/>
    <g transform="translate(0,-55)"><GoblinFace mood={mood}/></g>
    <line y1="-10" y2="60"/><line y1="15" x2="-48" y2={5-arm}/><line y1="15" x2="48" y2={5+arm}/>
    <line y1="60" x2="-38" y2={112+leg}/><line y1="60" x2="38" y2={112-leg}/>
    {label&&<text y="-128" textAnchor="middle" fill={accent} stroke="none" fontFamily="Arial Black,Arial,sans-serif" fontSize="20">{label}</text>}
  </g>;

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
