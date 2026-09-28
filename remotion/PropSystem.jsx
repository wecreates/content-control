import React from "react";
const K="#111111",W="#FFFFFF",Y="#F4C542",R="#EF3E36",T="#11A7A7";
const common={stroke:K,strokeWidth:5,fill:W,strokeLinecap:"round",strokeLinejoin:"round"};
const label=(text,y=8,size=18)=><text x="0" y={y} textAnchor="middle" fontFamily="Arial Black,Arial" fontSize={size} fill={K}>{text}</text>;

export const PropIcon=({id="prop",x=0,y=0,s=1,rotation=0,accent})=>{
 const docIds=["loan_contract","medical_bill","tax_form","boarding_pass","menu","coupon"];
 return <g transform={`translate(${x} ${y}) scale(${s}) rotate(${rotation})`}>
  {id==="card"?<g><rect x="-90" y="-55" width="180" height="110" rx="18" {...common}/><rect x="-62" y="-15" width="46" height="30" rx="5" fill={Y} stroke={K} strokeWidth="4"/><line x1="-68" y1="34" x2="42" y2="34" stroke={K} strokeWidth="4"/></g>:
   id==="coin"?<g><circle r="52" fill={accent||Y} stroke={K} strokeWidth="5"/><text x="0" y="17" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="52" fill={K}>$</text></g>:
   id==="receipt"?<g><path d="M-70 -90 H70 V78 L50 92 L30 78 L10 92 L-10 78 L-30 92 L-50 78 L-70 92 Z" {...common}/>{[-46,-18,10,38].map((yy,i)=><line key={i} x1="-44" y1={yy} x2={i===3?22:44} y2={yy} stroke={K} strokeWidth="4"/>)}</g>:
   id==="calculator"?<g><rect x="-72" y="-92" width="144" height="184" rx="18" {...common}/><rect x="-46" y="-64" width="92" height="38" rx="5" fill="#f4f4f4" stroke={K} strokeWidth="4"/>{[0,1,2,3,4,5,6,7,8].map(i=><circle key={i} cx={-34+(i%3)*34} cy={8+Math.floor(i/3)*34} r="8" fill={i===8?R:K}/>)}</g>:
   id==="phone"?<g><rect x="-58" y="-102" width="116" height="204" rx="22" {...common}/><rect x="-42" y="-72" width="84" height="136" rx="9" fill="#f7f7f7" stroke={K} strokeWidth="3"/><circle cy="82" r="8" fill={K}/></g>:
   id==="price_tag"?<g><path d="M-86 -48 L20 -48 L86 0 L20 48 L-86 48 Z" fill={accent||R} stroke={K} strokeWidth="5"/><circle cx="42" cy="0" r="10" fill={W} stroke={K} strokeWidth="4"/><text x="-24" y="12" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="28" fill={W}>SALE</text></g>:
   id==="fee_meter"||id==="score_gauge"||id==="flood_meter"?<g><path d="M-80 55 A80 80 0 0 1 80 55" fill="none" stroke={K} strokeWidth="8"/><line x1="0" y1="55" x2="42" y2="-12" stroke={id==="score_gauge"?T:R} strokeWidth="8" strokeLinecap="round"/>{label(id==="fee_meter"?"FEE":id==="score_gauge"?"SCORE":"DEBT",92,25)}</g>:
   id==="wallet"?<g><rect x="-92" y="-62" width="184" height="124" rx="20" fill={accent||T} stroke={K} strokeWidth="5"/><rect x="18" y="-22" width="86" height="44" rx="12" fill={W} stroke={K} strokeWidth="5"/><circle cx="44" cy="0" r="6" fill={K}/></g>:
   id==="calendar"?<g><rect x="-72" y="-72" width="144" height="144" rx="14" {...common}/><line x1="-72" y1="-34" x2="72" y2="-34" stroke={K} strokeWidth="5"/>{[-38,0,38].map((cx,i)=><circle key={i} cx={cx} cy="14" r="7" fill={i===1?R:K}/>)}</g>:
   id==="clock"?<g><circle r="68" {...common}/><line x1="0" y1="0" x2="0" y2="-38" stroke={K} strokeWidth="6"/><line x1="0" y1="0" x2="32" y2="14" stroke={K} strokeWidth="6"/></g>:
   id==="luggage"?<g><rect x="-62" y="-74" width="124" height="148" rx="18" {...common}/><path d="M-28 -74 v-28 h56 v28" fill="none" stroke={K} strokeWidth="5"/><circle cx="-36" cy="84" r="8" fill={K}/><circle cx="36" cy="84" r="8" fill={K}/></g>:
   id==="hotel_key"||id==="subscription_badge"?<g><rect x="-82" y="-48" width="164" height="96" rx="16" fill={id==="subscription_badge"?Y:W} stroke={K} strokeWidth="5"/>{label(id==="hotel_key"?"ROOM":"SUB",10,24)}</g>:
   id==="gas_pump"?<g><rect x="-62" y="-90" width="124" height="180" rx="10" {...common}/><rect x="-36" y="-62" width="72" height="48" fill="#f5f5f5" stroke={K} strokeWidth="4"/><path d="M62 -48 q48 0 42 52 v54" fill="none" stroke={K} strokeWidth="6"/></g>:
   id==="car_key"?<g><circle cx="-40" cy="0" r="34" {...common}/><line x1="-6" y1="0" x2="78" y2="0" stroke={K} strokeWidth="10"/><line x1="48" y1="0" x2="48" y2="24" stroke={K} strokeWidth="8"/></g>:
   id==="gavel"?<g transform="rotate(-25)"><rect x="-62" y="-32" width="124" height="64" rx="10" {...common}/><line x1="0" y1="32" x2="0" y2="120" stroke={K} strokeWidth="12"/></g>:
   id==="stock_ticker"||id==="points_counter"?<g><rect x="-100" y="-54" width="200" height="108" rx="14" {...common}/><polyline points="-78,28 -42,-4 -12,12 20,-28 52,-12 80,-42" fill="none" stroke={id==="points_counter"?Y:T} strokeWidth="7"/>{label(id==="points_counter"?"POINTS":"MARKET",-22,18)}</g>:
   id==="slot_machine"?<g><rect x="-84" y="-98" width="168" height="196" rx="18" {...common}/><rect x="-60" y="-50" width="120" height="72" fill="#f7f7f7" stroke={K} strokeWidth="4"/><text x="0" y="-2" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="34" fill={R}>7 $ 7</text><line x1="84" y1="-34" x2="120" y2="-54" stroke={K} strokeWidth="8"/></g>:
   id==="debt_chain"?<g>{[-50,0,50].map((cx,i)=><ellipse key={i} cx={cx} cy="0" rx="38" ry="22" fill="none" stroke={K} strokeWidth="10" transform={`rotate(${i%2?25:-25} ${cx} 0)`}/>)}</g>:
   id==="reward_box"?<g><rect x="-76" y="-58" width="152" height="116" fill={Y} stroke={K} strokeWidth="5"/><line x1="0" y1="-58" x2="0" y2="58" stroke={K} strokeWidth="5"/><path d="M0 -58 q-46 -42 -64 0 M0 -58 q46 -42 64 0" fill="none" stroke={K} strokeWidth="5"/></g>:
   id==="vault_door"?<g><circle r="88" {...common}/><circle r="50" fill="none" stroke={K} strokeWidth="6"/><line x1="-50" y1="0" x2="50" y2="0" stroke={K} strokeWidth="7"/><line x1="0" y1="-50" x2="0" y2="50" stroke={K} strokeWidth="7"/></g>:
   id==="shopping_cart"?<g><path d="M-90 -52 H-64 L-42 42 H60 L82 -30 H-54" fill="none" stroke={K} strokeWidth="6"/><circle cx="-24" cy="66" r="10" fill={K}/><circle cx="50" cy="66" r="10" fill={K}/></g>:
   id==="treadmill"?<g><rect x="-96" y="22" width="192" height="42" rx="20" {...common}/><line x1="62" y1="22" x2="88" y2="-88" stroke={K} strokeWidth="8"/><rect x="70" y="-104" width="58" height="42" rx="8" {...common}/></g>:
   id==="bucket"?<g><path d="M-62 -48 H62 L46 70 H-46 Z" {...common}/><path d="M-44 -48 q44 -68 88 0" fill="none" stroke={K} strokeWidth="5"/></g>:
   id==="ice_cube"?<g><rect x="-64" y="-64" width="128" height="128" rx="16" fill="#EAF9FF" stroke={K} strokeWidth="5"/><path d="M-34 58 q18 24 36 0 q18 26 36 0" fill="none" stroke={T} strokeWidth="5"/></g>:
   id==="carrot"?<g transform="rotate(20)"><path d="M0 78 L-42 -42 Q0 -70 42 -42 Z" fill="#fff" stroke={K} strokeWidth="5"/><path d="M-10 -54 q-10 -44 -28 -52 M10 -54 q10 -44 28 -52 M0 -58 v-58" fill="none" stroke={K} strokeWidth="6"/></g>:
   id==="magnifying_glass"?<g><circle cx="-20" cy="-20" r="54" {...common}/><line x1="20" y1="20" x2="92" y2="92" stroke={K} strokeWidth="12"/></g>:
   docIds.includes(id)?<g><rect x="-72" y="-92" width="144" height="184" rx="10" {...common}/>{[-52,-18,16,50].map((yy,i)=><line key={i} x1="-46" y1={yy} x2={i===0?28:46} y2={yy} stroke={K} strokeWidth="4"/>) }{label(id.replaceAll("_"," ").toUpperCase().slice(0,12),82,13)}</g>:
   <g><rect x="-72" y="-46" width="144" height="92" rx="16" {...common}/>{label(String(id).replaceAll("_"," ").toUpperCase().slice(0,12),8,16)}</g>}
 </g>;
};