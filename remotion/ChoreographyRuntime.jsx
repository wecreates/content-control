import React from "react";
import {PropIcon} from "./PropSystem";
import {simulateBody} from "./Physics2D";

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
  const refSpeed=Math.min(18,(e.reference_speed||0)*14);
  const refDir=e.reference_direction||"stable";
  const refX=refDir==="right"?refSpeed*p:refDir==="left"?-refSpeed*p:0;
  const refY=refDir==="down"?refSpeed*p:refDir==="up"?-refSpeed*p:0;
  if(e.type==="punch_in") return `translate(${shake+refX}px,${refY}px) scale(${1+.09*p})`;
  if(e.type==="whip_pan") return `translate(${(1-p)*85+shake+refX}px,${refY}px)`;
  if(e.type==="impact_close") return `translate(${shake+refX}px,${refY}px) scale(${1.05+.05*Math.sin(p*Math.PI)})`;
  if(e.type==="snap_wide") return `translate(${shake+refX}px,${refY}px) scale(${1.12-.12*p})`;
  return `translate(${shake+refX}px,${refY}px)`;
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
      const startF=Math.round((a.start||0)*24),impactF=Math.round((a.impact||.5)*24);
      const p=curve(a.curve,actionProgress(localFrame,startF,impactF));
      const intensity=Math.max(.45,Math.min(1.5,a.intensity||1));
      const baseX=width*(.5+(i-.5)*.18),baseY=height*.38;
      const vx=(i%2?1:-1)*220*intensity,vy=-260*intensity;
      const world=choreography?.physics||{};
      const traj=simulateBody({x:baseX+(i%2?-120:120),y:baseY-140,vx,vy},Math.max(impactF+18,localFrame+1),{gravity:world.gravity||980,drag:world.drag||.08,restitution:world.restitution||.42,floor:height*.68});
      const phys=traj[Math.min(localFrame,traj.length-1)]||{x:baseX,y:baseY};
      const x=localFrame<impactF?phys.x:baseX+(1-p)*24*(i%2?1:-1);
      const y=localFrame<impactF?phys.y:baseY+Math.sin(p*Math.PI)*-18;
      const rot=(1-p)*(i%2?18:-18)+((localFrame-startF)*2*(i%2?1:-1));
      const sy=1-(Math.sin(p*Math.PI)*.09);
      return <g key={a.target+"-"+i} transform={`translate(${x} ${y}) scale(${1+.06*p} ${sy})`}>
        <PropIcon id={a.target} x={0} y={0} s={1} rotation={rot}/>
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
    const design=t.design||{};
    const raw=t.motion==="type"?String(t.content).slice(0,Math.max(1,Math.floor(String(t.content).length*p))):String(t.content||"");
    const lines=(design.lines?.length?design.lines:[raw]).slice(0,3);
    const fontSize=design.font_size||44,lineHeight=(design.line_height||1.05)*fontSize;
    const fill=t.emphasis==="numeric"?"#EF3E36":"#111";
    return <text key={i} x={width/2} y={y} textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight={design.weight||900} fontSize={fontSize} letterSpacing={design.tracking?design.tracking*fontSize:0} fill={fill} opacity={opacity} transform={`rotate(${rot} ${width/2} ${y}) scale(${scale})`} transformOrigin={`${width/2}px ${y}px`}>
      {lines.map((line,li)=><tspan key={li} x={width/2} dy={li===0?0:lineHeight}>{line}</tspan>)}
    </text>;
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


export const performanceTargets=(choreography,localFrame,characterId)=>{
  const events=(choreography?.contact_events||[]).filter(e=>e.actor===characterId);
  const active=events.find(e=>localFrame>=(e.contact_frame||0)&&localFrame<=(e.release_frame||999));
  if(!active)return {};
  const side=(active.ik_target?.hand||"nearest")==="left"?"left":"right";
  const target={x:side==="left"?-92:92,y:-18};
  return side==="left"?{leftHandTarget:target,armBend:26}:{rightHandTarget:target,armBend:26};
};
