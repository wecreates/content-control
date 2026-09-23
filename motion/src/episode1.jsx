
import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';

const C={bg:'#080d16',white:'#f8fafc',muted:'#94a3b8',green:'#5cff5c',red:'#ff5252',yellow:'#ffd84d',blue:'#6dd5ff'};
const CL={extrapolateLeft:'clamp',extrapolateRight:'clamp'};
const sec=(s,fps)=>Math.round(s*fps);
const env=(f,a,b,fade=10)=>Math.min(interpolate(f,[a,a+fade],[0,1],CL),interpolate(f,[b-fade,b],[1,0],CL));
const prog=(f,a,b)=>interpolate(f,[a,b],[0,1],CL);

const Txt=({children,x=0,y=0,size=70,color=C.white,opacity=1,rotate=0,scale=1,align='center',width=1500})=>(
  <div style={{position:'absolute',left:x,top:y,width,color,fontFamily:'Arial,Helvetica,sans-serif',fontSize:size,fontWeight:900,textAlign:align,lineHeight:1.02,opacity,
    transform:'rotate('+rotate+'deg) scale('+scale+')',transformOrigin:'center',textShadow:'0 4px 18px rgba(0,0,0,.45)'}}>{children}</div>
);

const KineticText=({text,start,end,y,size=90,color=C.white,frame,fps})=>{
  const a=sec(start,fps),b=sec(end,fps),p=prog(frame,a,b),op=env(frame,a,b,8);
  const s=.82+.18*spring({frame:Math.max(0,frame-a),fps,config:{damping:14,stiffness:170}});
  return <Txt y={y} size={size} color={color} opacity={op} scale={s} rotate={Math.sin(p*Math.PI*4)*.8}>{text}</Txt>;
};

const StickFigure=({x,y,scale=1,frame,panic=false,smile=false,lean=0,accent=C.white,walk=0})=>{
  const bob=Math.sin((frame+walk)*.35)*7*scale,arm=Math.sin((frame+walk)*.27)*24*scale,leg=Math.sin((frame+walk)*.27+Math.PI)*22*scale;
  const sw=8*scale,r=35*scale,body=150*scale;
  return <svg width={360*scale} height={430*scale} style={{position:'absolute',left:x,top:y+bob,overflow:'visible',transform:'rotate('+lean+'deg)'}}>
    <g stroke={accent} strokeWidth={sw} strokeLinecap="round" fill="none">
      <circle cx={180*scale} cy={70*scale} r={r}/>
      <line x1={180*scale} y1={105*scale} x2={180*scale} y2={(105+body)*scale}/>
      <line x1={180*scale} y1={150*scale} x2={(105+arm)*scale} y2={210*scale}/>
      <line x1={180*scale} y1={150*scale} x2={(255-arm)*scale} y2={195*scale}/>
      <line x1={180*scale} y1={(105+body)*scale} x2={(120+leg)*scale} y2={360*scale}/>
      <line x1={180*scale} y1={(105+body)*scale} x2={(240-leg)*scale} y2={360*scale}/>
    </g>
    <circle cx={168*scale} cy={63*scale} r={4*scale} fill={accent}/><circle cx={192*scale} cy={63*scale} r={4*scale} fill={accent}/>
    <path d={panic?'M '+164*scale+' '+88*scale+' Q '+180*scale+' '+74*scale+' '+196*scale+' '+88*scale:smile?'M '+162*scale+' '+82*scale+' Q '+180*scale+' '+100*scale+' '+198*scale+' '+82*scale:'M '+165*scale+' '+86*scale+' L '+195*scale+' '+86*scale}
      stroke={accent} strokeWidth={4*scale} fill="none" strokeLinecap="round"/>
  </svg>;
};

const Card=({x,y,frame,rotate=0,label='PREMIUM'})=>{
  const sh=(Math.sin(frame*.08)+1)/2;
  return <div style={{position:'absolute',left:x,top:y,width:330,height:200,borderRadius:28,border:'7px solid '+C.white,transform:'rotate('+rotate+'deg)',
    boxShadow:'0 0 '+(20+50*sh)+'px rgba(255,255,255,.18)',background:'linear-gradient(145deg,#141b28,#070b12)',overflow:'hidden'}}>
    <div style={{position:'absolute',top:26,left:28,fontSize:33,fontWeight:900,color:C.white,fontFamily:'Arial'}}>{label}</div>
    <div style={{position:'absolute',left:28,right:28,top:104,height:5,background:'#475569'}}/>
    <div style={{position:'absolute',left:-80+sh*520,top:-80,width:120,height:380,background:'rgba(255,255,255,.09)',transform:'rotate(22deg)'}}/>
  </div>;
};

const InterestMonster=({x,y,frame})=>{
  const breathe=1+Math.sin(frame*.09)*.035;
  return <svg width="360" height="400" style={{position:'absolute',left:x,top:y,transform:'scale('+breathe+')'}}>
    <path d="M50 330 Q25 190 80 100 Q180 15 280 100 Q335 190 310 330 Z" fill="#260b0b" stroke={C.red} strokeWidth="12"/>
    <circle cx="135" cy="165" r="22" fill={C.red}/><circle cx="225" cy="165" r="22" fill={C.red}/>
    <path d="M125 250 Q180 305 235 250" fill="none" stroke={C.red} strokeWidth="12" strokeLinecap="round"/>
    <text x="180" y="75" fill={C.red} textAnchor="middle" fontSize="48" fontWeight="900">$19.73</text>
  </svg>;
};

const DecorativeLadder=({x,y,frame})=><svg width="220" height="430" style={{position:'absolute',left:x,top:y,transform:'rotate('+Math.sin(frame*.22)*4+'deg)'}}>
  <g stroke={C.yellow} strokeWidth="12" strokeLinecap="round"><line x1="45" y1="15" x2="45" y2="405"/><line x1="175" y1="15" x2="175" y2="405"/>
    {[70,130,190,250,310,370].map(v=><line key={v} x1="45" y1={v} x2="175" y2={v}/>)}</g>
</svg>;

const TrapDoor=({x,y,open})=>{
  const angle=interpolate(open,[0,1],[0,72],CL);
  return <div style={{position:'absolute',left:x,top:y,width:430,height:560,perspective:900}}>
    <div style={{position:'absolute',left:0,top:0,width:430,height:560,background:'#111827',border:'8px solid '+C.red,transformOrigin:'bottom',transform:'rotateX('+angle+'deg)'}}/>
  </div>;
};

const SceneLabel=({text,frame,fps,a,b,color=C.white})=>{
  const op=env(frame,sec(a,fps),sec(b,fps),10),x=interpolate(frame,[sec(a,fps),sec(a,fps)+15],[160,20],CL);
  return <Txt x={x} y={55} width={1100} align="left" size={44} color={color} opacity={op}>{text}</Txt>;
};

export const Episode1=({publicationEnabled=false})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  if(publicationEnabled === false){} else {throw new Error('Publication must remain disabled');}
  const f=s=>sec(s,fps),v=(a,b)=>env(frame,f(a),f(b),12),p=(a,b)=>prog(frame,f(a),f(b));
  const camera={x:Math.sin(frame*.011)*22+Math.sin(frame*.031)*8,y:Math.cos(frame*.009)*14,s:1.015+Math.sin(frame*.006)*.018};
  const annualDrop=interpolate(frame,[f(7),f(10)],[-260,490],{...CL,easing:Easing.in(Easing.cubic)});
  const pointsLift=interpolate(frame,[f(44),f(52)],[0,-180],CL);
  const phoneX=interpolate(frame,[f(77),f(92)],[2100,980],CL);
  const monsterX=interpolate(frame,[f(164),f(177)],[2050,1220],CL);
  const ladderX=interpolate(frame,[f(252),f(267)],[2050,1430],CL);

  return <AbsoluteFill style={{backgroundColor:C.bg,overflow:'hidden'}}>
    <Audio src={staticFile('narration.mp3')}/>
    <div style={{position:'absolute',inset:-100,backgroundImage:'radial-gradient(circle at 25% 25%,rgba(109,213,255,.08),transparent 25%),linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)',backgroundSize:'auto,64px 64px,64px 64px',transform:'translate('+camera.x+'px,'+camera.y+'px) scale('+camera.s+')'}}/>
    <div style={{position:'absolute',inset:0,transform:'translate('+camera.x+'px,'+camera.y+'px) scale('+camera.s+')'}}>

      <div style={{opacity:v(0,15)}}>
        <StickFigure x={180} y={360} frame={frame} scale={1.25} smile/>
        <Card x={950} y={390} frame={frame} rotate={-5+Math.sin(frame*.1)*2}/>
        <KineticText frame={frame} fps={fps} start={0} end={5} y={110} size={112} text="METAL CARD."/>
        <KineticText frame={frame} fps={fps} start={2} end={7} y={245} size={56} color={C.muted} text="Important face. Groceries remain groceries."/>
        <div style={{position:'absolute',left:700,top:annualDrop,width:560,height:210,background:'#f8fafc',border:'10px solid '+C.red,transform:'rotate(-6deg)',boxShadow:'0 20px 60px rgba(0,0,0,.5)'}}>
          <Txt y={45} width={560} size={70} color="#111827">$200 ANNUAL FEE</Txt>
        </div>
        <KineticText frame={frame} fps={fps} start={10} end={15} y={790} size={80} color={C.yellow} text="YOUR CREDIT CARD HAS DLC."/>
      </div>

      <div style={{opacity:v(14,27)}}>
        <StickFigure x={760} y={395} frame={frame} scale={1.05}/>
        {[['REWARDS',C.green,0],['INTEREST',C.red,Math.PI/2],['BONUS',C.green,Math.PI],['0%*',C.yellow,Math.PI*1.5]].map(([label,color,phase])=>{
          const a=frame*.035+phase,x=900+Math.cos(a)*520,y=495+Math.sin(a)*260;
          return <div key={label} style={{position:'absolute',left:x-80,top:y-55,width:160,height:110,borderRadius:55,border:'6px solid '+color,display:'flex',alignItems:'center',justifyContent:'center',color,fontFamily:'Arial',fontSize:28,fontWeight:900,background:C.bg}}>{label}</div>;
        })}
        <KineticText frame={frame} fps={fps} start={15} end={27} y={105} size={72} text="4 WAYS THE CARD TRIES TO WIN"/>
      </div>

      <div style={{opacity:v(26,50)}}>
        <SceneLabel text="1 • REWARDS YOU ACTUALLY USE" frame={frame} fps={fps} a={26} b={50} color={C.green}/>
        <StickFigure x={210+Math.sin(frame*.08)*45} y={420} frame={frame} walk={frame} scale={1.05} smile/>
        {['GROCERIES','GAS','BILLS','RENT'].map((t,i)=>{
          const x=780+(i%2)*390,y=310+Math.floor(i/2)*260,k=spring({frame:Math.max(0,frame-f(29+i*2)),fps,config:{damping:12}});
          return <div key={t} style={{position:'absolute',left:x,top:y,transform:'scale('+k+') rotate('+Math.sin(frame*.03+i)*2+'deg)',width:300,height:160,borderRadius:30,border:'6px solid '+C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:42,fontWeight:900,fontFamily:'Arial',color:C.white,background:'#0d1724'}}>{t}</div>;
        })}
        <Txt x={1030} y={760} width={650} size={64} color={C.green}>$10,000 PLANNED</Txt>
      </div>

      <div style={{opacity:v(44,71)}}>
        <StickFigure x={320} y={420+pointsLift} frame={frame} scale={1.15} smile/>
        <div style={{position:'absolute',left:250,top:230+pointsLift,width:500,height:280,borderRadius:'50%',border:'8px solid '+C.green,boxShadow:'0 0 60px '+C.green+'33',display:'flex',alignItems:'center',justifyContent:'center',color:C.green,fontFamily:'Arial',fontSize:88,fontWeight:900,transform:'scale('+(1+p(44,52)*.25)+')'}}>30,000</div>
        <KineticText frame={frame} fps={fps} start={52} end={64} y={175} size={74} color={C.yellow} text="30,000 POINTS → $210"/>
        <div style={{position:'absolute',left:1000,top:470,width:470,height:230,border:'6px solid '+C.white,borderRadius:35}}><Txt y={55} width={470} size={55}>GROCERY CART</Txt></div>
        <KineticText frame={frame} fps={fps} start={61} end={71} y={800} size={54} color={C.muted} text="The counter looked like a yacht."/>
      </div>

      <div style={{opacity:v(70,108)}}>
        <SceneLabel text="THE CREDIT STARTS CHASING ALEX" frame={frame} fps={fps} a={70} b={108} color={C.green}/>
        <StickFigure x={420+Math.sin(frame*.22)*60} y={470} frame={frame} walk={frame*3} panic/>
        <div style={{position:'absolute',left:phoneX,top:360,width:330,height:500,border:'8px solid '+C.green,borderRadius:50,background:'#0b1420',boxShadow:'0 0 50px '+C.green+'22'}}>
          <Txt y={80} width={330} size={48} color={C.green}>USE YOUR</Txt><Txt y={145} width={330} size={62} color={C.green}>CREDIT</Txt><Txt y={285} width={330} size={90}>$10</Txt>
        </div>
        <KineticText frame={frame} fps={fps} start={92} end={108} y={760} size={94} color={C.red} text="SAVED: -$5"/>
      </div>

      <div style={{opacity:v(106,138)}}>
        <KineticText frame={frame} fps={fps} start={106} end={119} y={100} size={70} text="SETTLE THE YEAR"/>
        <div style={{position:'absolute',left:310,top:340,width:560,height:300,borderRadius:40,border:'8px solid '+C.red,background:'#130d12'}}><Txt y={50} width={560} size={54} color={C.red}>PREMIUM</Txt><Txt y={135} width={560} size={100}>$70</Txt></div>
        <div style={{position:'absolute',left:1050,top:340,width:560,height:300,borderRadius:40,border:'8px solid '+C.green,background:'#09140d'}}><Txt y={50} width={560} size={54} color={C.green}>FREE CARD</Txt><Txt y={135} width={560} size={100}>$200</Txt></div>
        <KineticText frame={frame} fps={fps} start={124} end={138} y={760} size={68} color={C.yellow} text="THE METAL CARD AVOIDS EYE CONTACT."/>
      </div>

      <div style={{opacity:v(136,206)}}>
        <SceneLabel text="2 • THE INTEREST MONSTER" frame={frame} fps={fps} a={136} b={206} color={C.red}/>
        <StickFigure x={320} y={480} frame={frame} scale={1.05} panic/>
        <div style={{position:'absolute',left:770,top:360,width:240,height:250,borderRadius:'50%',border:'7px solid '+C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:64,fontWeight:900,fontFamily:'Arial',color:C.green}}>+$20</div>
        <InterestMonster x={monsterX} y={310} frame={frame}/>
        <KineticText frame={frame} fps={fps} start={171} end={187} y={760} size={62} color={C.red} text="REWARDS PAID ONCE. INTEREST KEEPS BILLING."/>
        <div style={{opacity:v(184,206),position:'absolute',left:770,top:520,display:'flex',gap:70}}>
          <div style={{width:320,height:150,borderRadius:28,border:'6px solid '+C.red,display:'flex',alignItems:'center',justifyContent:'center',color:C.red,fontSize:36,fontWeight:900,fontFamily:'Arial'}}>MINIMUM</div>
          <div style={{width:390,height:150,borderRadius:28,border:'6px solid '+C.green,display:'flex',alignItems:'center',justifyContent:'center',color:C.green,fontSize:36,fontWeight:900,fontFamily:'Arial'}}>STATEMENT BALANCE</div>
        </div>
      </div>

      <div style={{opacity:v(204,300)}}>
        <SceneLabel text="3 • THE $300 CARROT" frame={frame} fps={fps} a={204} b={300} color={C.green}/>
        <StickFigure x={300} y={470} frame={frame} scale={1.05} panic/>
        <div style={{position:'absolute',left:870+Math.sin(frame*.08)*70,top:250,transform:'rotate('+Math.sin(frame*.06)*8+'deg)'}}>
          <svg width="420" height="430"><path d="M80 80 L350 130 L130 390 Z" fill={C.green}/><line x1="330" y1="120" x2="400" y2="35" stroke={C.green} strokeWidth="18"/><text x="160" y="220" fontSize="68" fontWeight="900" fill="#03120a">$300</text></svg>
        </div>
        <KineticText frame={frame} fps={fps} start={238} end={258} y={820} size={60} color={C.red} text="$500 GAP = SHOPPING THE BONUS INVENTED"/>
        <DecorativeLadder x={ladderX} y={400} frame={frame}/>
        <KineticText frame={frame} fps={fps} start={260} end={278} y={715} size={80} color={C.yellow} text="WINNING BACKWARDS"/>
        <KineticText frame={frame} fps={fps} start={278} end={300} y={805} size={50} color={C.muted} text="Delete. Delete. Why did we add a ladder? Delete."/>
      </div>

      <div style={{opacity:v(298,368)}}>
        <SceneLabel text="4 • SAME ZERO. DIFFERENT TRAP." frame={frame} fps={fps} a={298} b={368} color={C.yellow}/>
        <StickFigure x={270} y={500} frame={frame} scale={1} panic/>
        <div style={{position:'absolute',left:690,top:300,width:430,height:560,border:'9px solid '+C.green,background:'#09140d'}}><Txt y={80} width={430} size={100} color={C.green}>0%</Txt><Txt y={225} width={430} size={39} color={C.green}>INTRO APR</Txt></div>
        <div style={{position:'absolute',left:1260,top:300,width:430,height:560}}>
          <TrapDoor x={0} y={0} open={p(337,349)}/><Txt y={80} width={430} size={100} color={C.red}>0%*</Txt><Txt y={225} width={430} size={35} color={C.red}>IF PAID IN FULL</Txt>
        </div>
        <KineticText frame={frame} fps={fps} start={344} end={368} y={835} size={62} color={C.red} text="THAT LITTLE “IF” DESERVES A SPOTLIGHT."/>
      </div>

      <div style={{opacity:v(366,405)}}>
        <KineticText frame={frame} fps={fps} start={366} end={382} y={120} size={84} text="$1,200 ÷ 12 = $100 / MONTH"/>
        {[...Array(12)].map((_,i)=>{
          const col=i%6,row=Math.floor(i/6),active=p(371,392)>(i+1)/12;
          return <div key={i} style={{position:'absolute',left:560+col*155,top:360+row*220,width:120,height:150,borderRadius:18,border:'5px solid '+(active?C.green:C.muted),background:active?'#0b1b10':'#101722',display:'flex',alignItems:'center',justifyContent:'center',color:C.white,fontSize:28,fontWeight:900,fontFamily:'Arial'}}>$100</div>;
        })}
        <KineticText frame={frame} fps={fps} start={391} end={405} y={850} size={50} color={C.muted} text="Planning target. Not the issuer’s minimum-payment formula."/>
      </div>

      <div style={{opacity:v(404,438)}}>
        <KineticText frame={frame} fps={fps} start={404} end={438} y={80} size={86} text="ALEX’S FOUR RULES"/>
        {[['1','USE REWARDS YOU ACTUALLY VALUE',C.green],['2','DON’T LET DEBT EAT THE REWARD',C.red],['3','DON’T MANUFACTURE SPENDING',C.green],['4','READ THE CONDITION BESIDE 0%',C.yellow]].map(([n,t,c],i)=>{
          const k=spring({frame:Math.max(0,frame-f(407+i*3)),fps,config:{damping:11}});
          return <div key={n} style={{position:'absolute',left:420,top:290+i*155,width:1100,height:110,transform:'translateX('+((1-k)*800)+'px)',display:'flex',alignItems:'center',gap:35}}>
            <div style={{width:90,height:90,borderRadius:45,border:'6px solid '+c,display:'flex',alignItems:'center',justifyContent:'center',color:c,fontSize:46,fontWeight:900,fontFamily:'Arial'}}>{n}</div>
            <div style={{fontSize:44,fontWeight:900,fontFamily:'Arial',color:C.white}}>{t}</div>
          </div>;
        })}
      </div>

      <div style={{opacity:v(436,466)}}>
        <StickFigure x={240} y={420} frame={frame} scale={1.05} smile/>
        <Card x={980} y={530} frame={frame} label="CUTTING BOARD"/>
        {[0,1,2].map(i=><div key={i} style={{position:'absolute',left:1080+i*80,top:475,width:55,height:55,borderRadius:'50%',border:'5px solid '+C.green}}/>)}
        <div style={{position:'absolute',left:950+p(442,455)*380,top:380,width:210,height:16,background:C.white,transform:'rotate(42deg)',transformOrigin:'left center'}}/>
        <KineticText frame={frame} fps={fps} start={436} end={460} y={120} size={82} color={C.yellow} text="FINANCIAL EDUCATION COMPLETE."/>
      </div>

      <div style={{opacity:v(460,520)}}>
        <div style={{position:'absolute',left:0,top:0,right:0,bottom:0,background:'radial-gradient(circle at center,#17111a 0%,#050609 68%)'}}/>
        <div style={{position:'absolute',left:760,top:300,width:400,height:500,border:'6px solid '+C.red,boxShadow:'0 0 100px '+C.red+'22'}}>
          <div style={{position:'absolute',left:95,top:120,width:35,height:35,borderRadius:'50%',background:C.red}}/><div style={{position:'absolute',right:95,top:120,width:35,height:35,borderRadius:'50%',background:C.red}}/>
          <div style={{position:'absolute',left:90,top:280,width:220,height:110,border:'6px solid '+C.white,borderRadius:30,display:'flex',alignItems:'center',justifyContent:'center',color:C.white,fontSize:38,fontWeight:900,fontFamily:'Arial'}}>MINIMUM</div>
        </div>
        <KineticText frame={frame} fps={fps} start={462} end={520} y={120} size={72} color={C.red} text="NEXT: THE MINIMUM PAYMENT HORROR MOVIE"/>
      </div>
    </div>

    <div style={{position:'absolute',left:40,bottom:30,color:C.muted,fontFamily:'Arial',fontSize:18,fontWeight:700,letterSpacing:1}}>EPISODE 1 • MOTION REBUILD • REVIEW ONLY</div>
  </AbsoluteFill>;
};
