import React from "react";
const K="#111111",W="#FFFFFF";
const Face=({mood="smile"})=><g fill={K} stroke={K} strokeWidth="4" strokeLinecap="round">
  <circle cx="-11" cy="-10" r={mood==="shock"?5:4}/><circle cx="11" cy="-10" r={mood==="shock"?5:4}/>
  {mood==="shock"?<circle cy="10" r="10" fill="none"/>:
   mood==="mad"?<path d="M-14 12 Q0 -1 14 12" fill="none"/>:
   mood==="deadpan"?<path d="M-12 8 L12 8" fill="none"/>:
   mood==="panic"?<path d="M-13 11 Q0 21 13 11" fill="none"/>:
   <path d="M-13 5 Q0 17 13 5" fill="none"/>}
</g>;

const Base=({x,y,s=1,lean=0,mood="smile",label="",arm=0,leg=0,accent=K,headR=36,body=122,shoulders=66})=>
<g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
  <circle cy="-88" r={headR} fill={W}/><g transform="translate(0,-88)"><Face mood={mood}/></g>
  <line y1="-52" y2={body-52}/>
  <line x1="0" y1="-10" x2={-shoulders} y2={-10-arm}/><line x1="0" y1="-10" x2={shoulders} y2={-10+arm}/>
  <line x1="0" y1={body-52} x2={-55} y2={body+28+leg}/><line x1="0" y1={body-52} x2={55} y2={body+28-leg}/>
  {label&&<text y="-145" textAnchor="middle" fill={accent} stroke="none" fontFamily="Arial Black,Arial,sans-serif" fontSize="22">{label}</text>}
</g>;

export const Dave=(props)=><Base {...props} label={props.label??"DAVE"} headR={36} body={122} shoulders={66}/>;
export const PointsMonk=(props)=><Base {...props} label={props.label??"POINTS MONK"} mood={props.mood??"deadpan"} headR={34} body={136} shoulders={62}/>;
export const CashbackGoblin=({x,y,s=1,lean=0,mood="smile",label="",arm=0,leg=0,accent="#F4C542"})=>
  <g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} stroke={K} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cy="-55" r="44" fill={W}/><g transform="translate(0,-55)"><Face mood={mood}/></g>
    <line y1="-10" y2="60"/><line y1="15" x2="-48" y2={5-arm}/><line y1="15" x2="48" y2={5+arm}/>
    <line y1="60" x2="-38" y2={112+leg}/><line y1="60" x2="38" y2={112-leg}/>
    <circle cx="-42" cy="-78" r="9" fill={accent}/><circle cx="42" cy="-78" r="9" fill={accent}/>
    {label&&<text y="-120" textAnchor="middle" fill={accent} stroke="none" fontFamily="Arial Black,Arial,sans-serif" fontSize="20">{label}</text>}
  </g>;

export const characterMotion={
  dave:{recoil:{lean:-12,arm:26,leg:10},frozen_mid_reach:{lean:4,arm:-22,leg:0},wallet_clutch:{lean:8,arm:34,leg:4}},
  points_monk:{deadpan_point:{lean:0,arm:28,leg:0},door_kick:{lean:-14,arm:24,leg:34},calculator_drop:{lean:3,arm:-18,leg:0}},
  cashback_goblin:{coin_scamper:{lean:18,arm:30,leg:22},ankle_drag:{lean:-20,arm:36,leg:16},card_hug:{lean:0,arm:42,leg:0}}
};
