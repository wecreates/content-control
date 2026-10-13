import React from 'react';
const K='#111',W='#fff';
const Deck=({children})=><g stroke={K} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M110 910Q360 892 610 910L680 1090Q360 1132 40 1090Z" fill={W}/><path d="M40 1090V1110Q360 1152 680 1110V1090M100 1082Q360 1110 620 1082"/>{children}</g>;
const SnackCounter=({x})=><g transform={`translate(${x} 909)`} stroke={K} strokeWidth="4" fill={W} strokeLinejoin="round"><path d="M-74 0H74V151H-74Z"/><path d="M-80-12H80V4H-80Z"/><path d="M-50 27H50V96H-50Z"/><path d="M-26-16L-4-42 19-16Z"/><path d="M-24-13H20M31-34H48V-14H31Z"/><path d="M48-30Q62-29 48-18" fill="none"/></g>;
// Scene furniture is behind the action and below the caption/prop reserve.
// Distinct silhouettes establish place without adding competing labels.
export function V2StageEnvironment({beat}) {
 const arena=['cold-open','chase-strike','fee-drain'].includes(beat);
 const lounge=['amex-counter','points-summon'].includes(beat);
 const checkpoint=['trap','final-clash'].includes(beat);
 if(!arena&&!lounge&&!checkpoint&&beat!=='finish')return null;
 return <g data-v2-setting={arena?'arena':lounge?'snack-lounge':checkpoint?'value-checkpoint':'victory-platform'}>
  {arena?<Deck><path d="M250 1085L300 1030M470 1085L420 1030"/><path d="M55 1027V976M665 1027V976M45 976H65M655 976H675" strokeWidth="5"/>{beat==='fee-drain'?<path d="M340 1045L325 1060 350 1068 335 1085M385 1045L395 1060 375 1076"/>:null}</Deck>:null}
  {lounge?<g><path d="M40 1060H680M50 1080H670" fill="none" stroke={K} strokeWidth="3"/><SnackCounter x={beat==='amex-counter'?365:135}/></g>:null}
  {checkpoint?<g stroke={K} fill={W} strokeWidth="4"><path d="M220 944L130 1110M500 944L590 1110M85 1110H635" fill="none"/><path d="M60 1040V914M660 1040V914"/>{beat==='trap'?<path d="M88 428V958M632 428V958M88 445H632" fill="none" strokeWidth="3"/>:null}<circle cx="60" cy="906" r="10"/><circle cx="660" cy="906" r="10"/><path d="M60 1024H118M602 1024H660" fill="none"/>{beat==='final-clash'?<path d="M314 1084l25 20 65-47" fill="none" strokeWidth="6"/>:null}</g>:null}
  {beat==='finish'?<g stroke={K} strokeWidth="4" fill={W}><path d="M240 1080H480L515 1108H205Z"/><path d="M205 1108V1150H515V1108M240 1080V1120H480V1080"/><path d="M341 1134l12 10 27-24" fill="none"/></g>:null}
 </g>;
}
