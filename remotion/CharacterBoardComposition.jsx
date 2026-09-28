import React from "react";
import {AbsoluteFill} from "remotion";
import {Dave,PointsMonk,CashbackGoblin} from "./CharacterSystem";
const Label=({x,y,text,color="#111"})=><text x={x} y={y} textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="34" fill={color}>{text}</text>;
export const CharacterBoardComposition=()=> <AbsoluteFill style={{background:"#fff"}}>
<svg width="1600" height="1000" viewBox="0 0 1600 1000">
<text x="60" y="70" fontFamily="Arial Black,Arial" fontSize="42" fill="#111">CONTENT CONTROL — RENDERER-LOCKED CHARACTER BOARD</text>
<text x="60" y="108" fontFamily="Arial, sans-serif" fontSize="20" fill="#666">Every figure below is rendered from remotion/CharacterSystem.jsx — the same source used in videos.</text>
<g transform="translate(260 510) scale(1.35)"><Dave x={0} y={0} s={1} mood="shock"/></g><Label x={260} y={820} text="DAVE" color="#11A7A7"/>
<g transform="translate(800 500) scale(1.35)"><PointsMonk x={0} y={0} s={1} mood="deadpan"/></g><Label x={800} y={820} text="POINTS MONK" color="#EF3E36"/>
<g transform="translate(1320 555) scale(1.35)"><CashbackGoblin x={0} y={0} s={1} mood="smile"/></g><Label x={1320} y={820} text="CASHBACK GOBLIN" color="#F4C542"/>
<line x1="70" y1="870" x2="1530" y2="870" stroke="#ddd" strokeWidth="2"/>
<text x="60" y="920" fontFamily="Arial, sans-serif" fontSize="20" fill="#111">LOCK: same renderer • same geometry • same stroke • same accent palette • pose/expression changes only</text>
</svg></AbsoluteFill>;