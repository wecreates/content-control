import React from "react";
const K="#111111",W="#FFFFFF",Y="#F4C542",R="#EF3E36",T="#11A7A7";
export const PropIcon=({id="prop",x=0,y=0,s=1,rotation=0,accent})=>{
 const common={stroke:K,strokeWidth:5,fill:W,strokeLinecap:"round",strokeLinejoin:"round"};
 return <g transform={`translate(${x} ${y}) scale(${s}) rotate(${rotation})`}>
  {id==="card"?<g><rect x="-90" y="-55" width="180" height="110" rx="18" {...common}/><rect x="-62" y="-15" width="46" height="30" rx="5" fill={Y} stroke={K} strokeWidth="4"/><line x1="-68" y1="34" x2="42" y2="34" stroke={K} strokeWidth="4"/></g>:
   id==="coin"?<g><circle r="52" fill={accent||Y} stroke={K} strokeWidth="5"/><text x="0" y="17" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="52" fill={K}>$</text></g>:
   id==="receipt"?<g><path d="M-70 -90 H70 V78 L50 92 L30 78 L10 92 L-10 78 L-30 92 L-50 78 L-70 92 Z" {...common}/>{[-46,-18,10,38].map((yy,i)=><line key={i} x1="-44" y1={yy} x2={i===3?22:44} y2={yy} stroke={K} strokeWidth="4"/>)}</g>:
   id==="calculator"?<g><rect x="-72" y="-92" width="144" height="184" rx="18" {...common}/><rect x="-46" y="-64" width="92" height="38" rx="5" fill="#f4f4f4" stroke={K} strokeWidth="4"/>{[0,1,2,3,4,5,6,7,8].map(i=><circle key={i} cx={-34+(i%3)*34} cy={8+Math.floor(i/3)*34} r="8" fill={i===8?R:K}/>)}</g>:
   id==="phone"?<g><rect x="-58" y="-102" width="116" height="204" rx="22" {...common}/><rect x="-42" y="-72" width="84" height="136" rx="9" fill="#f7f7f7" stroke={K} strokeWidth="3"/><circle cy="82" r="8" fill={K}/></g>:
   id==="price_tag"?<g><path d="M-86 -48 L20 -48 L86 0 L20 48 L-86 48 Z" fill={accent||R} stroke={K} strokeWidth="5"/><circle cx="42" cy="0" r="10" fill={W} stroke={K} strokeWidth="4"/><text x="-24" y="12" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="28" fill={W}>SALE</text></g>:
   id==="fee_meter"?<g><path d="M-80 55 A80 80 0 0 1 80 55" fill="none" stroke={K} strokeWidth="8"/><line x1="0" y1="55" x2="42" y2="-12" stroke={R} strokeWidth="8" strokeLinecap="round"/><text x="0" y="92" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="30" fill={R}>FEE</text></g>:
   id==="wallet"?<g><rect x="-92" y="-62" width="184" height="124" rx="20" fill={accent||T} stroke={K} strokeWidth="5"/><rect x="18" y="-22" width="86" height="44" rx="12" fill={W} stroke={K} strokeWidth="5"/><circle cx="44" cy="0" r="6" fill={K}/></g>:
   <g><rect x="-72" y="-46" width="144" height="92" rx="16" {...common}/><text x="0" y="8" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="18" fill={K}>{String(id).toUpperCase().slice(0,10)}</text></g>}
 </g>;
};