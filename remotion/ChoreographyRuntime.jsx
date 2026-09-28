import React from "react";

const clamp=v=>Math.max(0,Math.min(1,v));
const easeOutBack=p=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2)};
const springish=p=>1-Math.cos(p*Math.PI*2)*Math.exp(-5*p);
const curve=(name,p)=>{
  p=clamp(p);
  if(name==="heavy_drop") return 1-Math.pow(1-p,4);
  if(name==="nervous_hesitation") return Math.round(p*5)/5;
  if(name==="elastic_goblin") return springish(p);
  if(name==="deadpan") return p<.7?0:p;
  return easeOutBack(p);
};
const actionProgress=(frame,start=0,impact=12)=>clamp((frame-start)/Math.max(1,impact-start));

export const choreographyCamera=(ch,localFrame)=>{
  const e=(ch?.camera_events||[])[0];
  if(!e) return "none";
  const p=clamp(localFrame/Math.max(1,e.impact_frame||12));
  const shake=e.micro_shake?Math.sin(localFrame*1.8)*2*(1-p):0;
  if(e.type==="punch_in") return `translate(${shake}px,0) scale(${1+.09*p})`;
  if(e.type==="whip_pan") return `translateX(${(1-p)*85+shake}px)`;
  if(e.type==="impact_close") return `translate(${shake}px,0) scale(${1.05+.05*Math.sin(p*Math.PI)})`;
  if(e.type==="snap_wide") return `translate(${shake}px,0) scale(${1.12-.12*p})`;
  return `translate(${shake}px,0)`;
};

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

const objectGlyph=id=>({
  card:"CARD",coin:"$",receipt:"RECEIPT",calculator:"123",phone:"PHONE",price_tag:"SALE",fee_meter:"FEE",wallet:"WALLET"
}[id]||String(id||"PROP").toUpperCase().slice(0,10));

export const ObjectChoreography=({choreography,localFrame,width=720,height=1280})=>{
  return <g>
    {(choreography?.object_actions||[]).map((a,i)=>{
      const p=curve(a.curve,actionProgress(localFrame,Math.round((a.start||0)*24),Math.round((a.impact||.5)*24)));
      const x=width*(.5+(i-.5)*.18)+(1-p)*120*(i%2?1:-1);
      const y=height*.38+(1-p)*-140;
      const rot=(1-p)*(i%2?18:-18);
      const sy=1-(Math.sin(p*Math.PI)*.09);
      return <g key={a.target+"-"+i} transform={`translate(${x} ${y}) rotate(${rot}) scale(${1+.06*p} ${sy})`}>
        <rect x="-78" y="-48" width="156" height="96" rx="18" fill="#fff" stroke="#111" strokeWidth="5"/>
        <text x="0" y="10" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="24" fill="#111">{objectGlyph(a.target)}</text>
      </g>;
    })}
  </g>;
};

export const KineticText=({choreography,localFrame,width=720})=>{
  return <g>{(choreography?.text_actions||[]).map((t,i)=>{
    const p=clamp((localFrame-(t.entry_frame||0))/10);
    let scale=.8+.2*easeOutBack(p),rot=0,y=120+i*70,opacity=p;
    if(t.motion==="slam"){scale=1.7-.7*easeOutBack(p);y=90+i*70}
    if(t.motion==="shake"){rot=Math.sin(localFrame*2.2)*3*(1-p*.4)}
    if(t.motion==="stamp"){scale=2.2-1.2*clamp(p*1.4)}
    if(t.motion==="stretch"){scale=.7+.3*p}
    if(t.motion==="type"){opacity=1}
    const content=t.motion==="type"?String(t.content).slice(0,Math.max(1,Math.floor(String(t.content).length*p))):t.content;
    return <text key={i} x={width/2} y={y} textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="44" fill="#111" opacity={opacity} transform={`rotate(${rot} ${width/2} ${y}) scale(${scale})`} transformOrigin={`${width/2}px ${y}px`}>{content}</text>;
  })}</g>;
};

export const OverlayChoreography=({choreography,localFrame,width=720,height=1280})=>{
  return <g>{(choreography?.overlays||[]).map((o,i)=>{
    const p=clamp(localFrame/8);
    const y=height*.27+i*54;
    return <g key={i} opacity={(o.opacity??.85)*p}>
      <line x1={width*.18} y1={y} x2={width*.36} y2={y+38} stroke="#EF3E36" strokeWidth="5"/>
      <circle cx={width*.17} cy={y} r="7" fill="#EF3E36"/>
      <rect x={width*.37} y={y+14} width="210" height="46" rx="12" fill="#fff" stroke="#111" strokeWidth="3"/>
      <text x={width*.37+105} y={y+44} textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="18" fill="#111">{String(o.purpose||"LOOK HERE").replaceAll("_"," ").toUpperCase()}</text>
    </g>;
  })}</g>;
};

export const DepthBackground=({choreography,localFrame,width=720,height=1280})=>{
  const layers=choreography?.depth_layers||[];
  return <g>{layers.map((l,i)=>{
    const dx=Math.sin(localFrame/22+i)*10*(l.parallax||1);
    return <g key={l.id} opacity={i===0?.18:i===1?.1:.06} transform={`translate(${dx} 0)`}>
      <circle cx={width*(.15+i*.33)} cy={height*(.28+i*.18)} r={95-i*18} fill="none" stroke="#111" strokeWidth="3"/>
      <line x1="0" y1={height*(.72+i*.05)} x2={width} y2={height*(.72+i*.05)} stroke="#111" strokeWidth="3"/>
    </g>;
  })}</g>;
};

export const MicroGags=({choreography,localFrame,width=720,height=1280})=>{
  return <g>{(choreography?.visual_gags||[]).map((g,i)=>{
    const p=clamp((localFrame-(g.frame||16))/6);
    return <g key={i} opacity={p} transform={`translate(${width*.82} ${height*.7}) scale(${.4+.6*p})`}>
      <circle r="34" fill="#F4C542" stroke="#111" strokeWidth="4"/>
      <text x="0" y="9" textAnchor="middle" fontFamily="Arial Black,Arial" fontSize="24" fill="#111">!</text>
    </g>;
  })}</g>;
};

export const ContactCue=({choreography,localFrame,width=720,height=1280})=>{
  return <g>{(choreography?.contact_events||[]).map((e,i)=>{
    const on=localFrame>=(e.contact_frame||0)&&localFrame<=(e.release_frame||999);
    return on?<g key={i} transform={`translate(${width*.5} ${height*.57})`}>
      <path d="M-28 -12 L-52 -30 M28 -12 L52 -30 M0 -28 L0 -58" stroke="#EF3E36" strokeWidth="6" strokeLinecap="round"/>
    </g>:null;
  })}</g>;
};
