import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const C = {
  bg: "#0c1018",
  white: "#f5f7fa",
  muted: "#8d96a6",
  green: "#39ff14",
  red: "#ff4a4a",
  yellow: "#ffdc50",
  panel: "#151c28",
};

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

const fade = (t, a, b, c, d) =>
  interpolate(t, [a, b, c, d], [0, 1, 1, 0], clamp);

const appear = (frame, fps, start, dur = 0.35) =>
  spring({frame: frame - start * fps, fps, config: {damping: 14, stiffness: 160, mass: 0.75}, durationInFrames: Math.round(dur * fps)});

const tx = (t, points, values) => interpolate(t, points, values, {...clamp, easing: Easing.inOut(Easing.cubic)});

const Stick = ({x, y, scale = 1, pose = 0, face = "neutral", color = C.white, opacity = 1}) => {
  const arm = Math.sin(pose) * 34;
  const leg = Math.sin(pose * 0.7) * 18;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round">
      <circle cx="0" cy="-70" r="25" />
      <line x1="0" y1="-45" x2="0" y2="72" />
      <line x1="0" y1="-15" x2={-58 - arm} y2={30 + arm * 0.35} />
      <line x1="0" y1="-15" x2={58 + arm} y2={-5 - arm * 0.25} />
      <line x1="0" y1="72" x2={-44 - leg} y2="145" />
      <line x1="0" y1="72" x2={44 + leg} y2="145" />
      <circle cx="-9" cy="-76" r="2.8" fill={color} stroke="none" />
      <circle cx="9" cy="-76" r="2.8" fill={color} stroke="none" />
      {face === "panic" ? (
        <path d="M -10 -55 Q 0 -67 10 -55" />
      ) : face === "smile" ? (
        <path d="M -11 -62 Q 0 -48 11 -62" />
      ) : (
        <line x1="-9" y1="-57" x2="9" y2="-57" />
      )}
    </g>
  );
};

const Alex = (props) => <Stick {...props} />;

const InterestMonster = ({x, y, scale = 1, opacity = 1, grin = 0}) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    <path d="M -110 90 Q -135 -20 -95 -120 Q 0 -175 95 -120 Q 135 -20 110 90 Z" fill="#22090c" stroke={C.red} strokeWidth="8" />
    <circle cx="-38" cy="-55" r="10" fill={C.red} />
    <circle cx="38" cy="-55" r="10" fill={C.red} />
    <path d={`M -55 20 Q 0 ${55 + grin * 25} 55 20`} fill="none" stroke={C.red} strokeWidth="7" strokeLinecap="round" />
    <text x="-66" y="-105" fill={C.red} fontSize="34" fontWeight="900">$</text>
    <text x="28" y="-105" fill={C.red} fontSize="34" fontWeight="900">%</text>
  </g>
);

const MoneyText = ({x, y, text, color = C.white, size = 48, opacity = 1, scale = 1, rotate = 0}) => (
  <text
    x={x}
    y={y}
    fill={color}
    opacity={opacity}
    fontFamily="Arial, Helvetica, sans-serif"
    fontSize={size}
    fontWeight="900"
    textAnchor="middle"
    transform={`rotate(${rotate} ${x} ${y}) scale(${scale})`}
    style={{paintOrder: "stroke", stroke: C.bg, strokeWidth: 6}}
  >
    {text}
  </text>
);

const KineticCaption = ({t, start, end, children, y = 610, color = C.white, size = 32}) => {
  const o = fade(t, start, start + 0.12, end - 0.16, end);
  const yy = interpolate(o, [0, 1], [y + 15, y], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: yy,
        color,
        opacity: o,
        fontFamily: "Arial, Helvetica, sans-serif",
        fontWeight: 900,
        fontSize: size,
        textAlign: "center",
        letterSpacing: 0.5,
        textShadow: "0 4px 18px #000",
      }}
    >
      {children}
    </div>
  );
};

const CameraRig = ({t, children}) => {
  // One persistent world: camera glides instead of hard scene cards.
  const x = tx(t, [0, 12, 32, 62, 96, 130, 168, 206, 246, 276, 306], [0, -130, -420, -830, -1250, -1680, -2140, -2520, -2940, -3320, -3620]);
  const y = 18 * Math.sin(t * 0.18) + tx(t, [0, 85, 165, 245, 306], [0, -22, 28, -18, 0]);
  const z = tx(t, [0, 9, 16, 50, 95, 133, 185, 230, 275, 306], [1.08, 1.17, 1.02, 1.08, 1.0, 1.13, 1.03, 1.1, 1.04, 1.08]);
  return (
    <div style={{position: "absolute", inset: 0, transform: `translate(${x}px,${y}px) scale(${z})`, transformOrigin: "50% 50%"}}>
      {children}
    </div>
  );
};

const WorldGrid = ({t}) => {
  const drift = (t * 18) % 80;
  return (
    <svg width="5200" height="900" style={{position: "absolute", left: -200, top: -90}}>
      <defs>
        <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse" x={drift}>
          <path d="M80 0 L0 0 0 80" fill="none" stroke="#182130" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="5200" height="900" fill="url(#grid)" />
    </svg>
  );
};

const AnnualFee = ({t}) => {
  const p = Math.min(1, Math.max(0, (t - 5.5) / 1.1));
  const y = -180 + p * 500;
  const wobble = Math.sin((t - 6.5) * 18) * Math.max(0, 1 - Math.abs(t - 6.6)) * 12;
  return (
    <g transform={`translate(720 ${y}) rotate(${wobble})`} opacity={fade(t, 5.2, 5.5, 11.2, 11.7)}>
      <rect x="-180" y="-70" width="360" height="140" rx="16" fill="#f4f1e8" stroke={C.red} strokeWidth="7" />
      <text x="0" y="-5" textAnchor="middle" fontSize="48" fontWeight="900" fill="#161616">$200 ANNUAL FEE</text>
      <text x="0" y="40" textAnchor="middle" fontSize="23" fontWeight="700" fill="#444">PREMIUM EXPERIENCE TAX</text>
    </g>
  );
};

const MetalCard = ({t}) => {
  const rot = -8 + Math.sin(t * 2.5) * 2;
  return (
    <g transform={`translate(500 390) rotate(${rot})`} opacity={fade(t, 0, 0.2, 22, 23)}>
      <rect x="-155" y="-82" width="310" height="164" rx="24" fill="#202938" stroke={C.white} strokeWidth="7" />
      <rect x="-130" y="-50" width="55" height="38" rx="7" fill={C.yellow} />
      <text x="-128" y="42" fill={C.white} fontSize="27" fontWeight="900">PREMIUM</text>
      <circle cx="110" cy="-40" r="13" fill={C.green} />
    </g>
  );
};

const PointsBalloon = ({t}) => {
  const a = fade(t, 39, 39.5, 59, 60);
  const grow = interpolate(t, [39, 47], [0.25, 1], clamp);
  const bob = Math.sin(t * 2.6) * 18;
  const pop = t > 54 ? interpolate(t, [54, 54.4], [1, 0], clamp) : 1;
  return (
    <g transform={`translate(1160 ${300 + bob}) scale(${grow * pop})`} opacity={a}>
      <ellipse cx="0" cy="0" rx="118" ry="95" fill="#112c13" stroke={C.green} strokeWidth="7" />
      <text x="0" y="12" textAnchor="middle" fill={C.green} fontSize="48" fontWeight="900">30,000</text>
      <line x1="0" y1="95" x2="-15" y2="220" stroke={C.white} strokeWidth="3" />
    </g>
  );
};

const CreditPhone = ({t}) => {
  const a = fade(t, 68, 68.3, 89, 90);
  const chase = interpolate(t, [68, 89], [0, 580], clamp);
  const bounce = Math.sin(t * 8) * 10;
  return (
    <g transform={`translate(${1450 + chase} ${320 + bounce})`} opacity={a}>
      <rect x="-90" y="-145" width="180" height="290" rx="26" fill="#111820" stroke={C.green} strokeWidth="7" />
      <circle cx="-35" cy="35" r="8" fill={C.white} />
      <circle cx="35" cy="35" r="8" fill={C.white} />
      <path d="M -42 70 Q 0 100 42 70" fill="none" stroke={C.white} strokeWidth="5" />
      <text x="0" y="-45" textAnchor="middle" fill={C.green} fontSize="29" fontWeight="900">USE YOUR</text>
      <text x="0" y="-5" textAnchor="middle" fill={C.green} fontSize="34" fontWeight="900">CREDIT</text>
      <line x1="-85" y1="90" x2="-125" y2="130" stroke={C.white} strokeWidth="6" />
      <line x1="85" y1="90" x2="125" y2="130" stroke={C.white} strokeWidth="6" />
    </g>
  );
};

const Scoreboard = ({t}) => {
  const a = fade(t, 101, 101.3, 126, 127);
  const s = 0.88 + 0.12 * appear(Math.round(t * 30), 30, 101);
  return (
    <g transform={`translate(2020 310) scale(${s})`} opacity={a}>
      <rect x="-240" y="-140" width="480" height="280" rx="28" fill={C.panel} stroke="#28364c" strokeWidth="6" />
      <text x="0" y="-82" textAnchor="middle" fill={C.muted} fontSize="25" fontWeight="900">SAME SPENDING</text>
      <text x="0" y="-15" textAnchor="middle" fill={C.red} fontSize="45" fontWeight="900">PREMIUM  $70</text>
      <text x="0" y="55" textAnchor="middle" fill={C.green} fontSize="45" fontWeight="900">FREE  $200</text>
      <text x="0" y="108" textAnchor="middle" fill={C.white} fontSize="24" fontWeight="700">Alex: -$130 for choosing shiny</text>
    </g>
  );
};

const BonusCart = ({t}) => {
  const a = fade(t, 184, 184.4, 232, 233);
  const ladder = t > 205 ? 1 : 0;
  const shake = Math.sin(t * 20) * (t > 205 && t < 218 ? 8 : 2);
  return (
    <g transform={`translate(${2940 + shake} 390)`} opacity={a}>
      <rect x="-210" y="20" width="420" height="110" rx="18" fill="none" stroke={C.white} strokeWidth="7" />
      <circle cx="-120" cy="155" r="28" fill="none" stroke={C.white} strokeWidth="7" />
      <circle cx="120" cy="155" r="28" fill="none" stroke={C.white} strokeWidth="7" />
      <rect x="-170" y="-55" width="95" height="75" rx="10" fill="#2c3440" stroke={C.white} strokeWidth="4" />
      <rect x="-45" y="-80" width="100" height="100" rx="20" fill="#2c3440" stroke={C.white} strokeWidth="4" />
      {ladder > 0 && (
        <g transform="translate(105 -210) rotate(8)">
          <line x1="-35" y1="-100" x2="-35" y2="145" stroke={C.yellow} strokeWidth="7" />
          <line x1="35" y1="-100" x2="35" y2="145" stroke={C.yellow} strokeWidth="7" />
          {[-70, -20, 30, 80].map((yy) => <line key={yy} x1="-35" y1={yy} x2="35" y2={yy} stroke={C.yellow} strokeWidth="6" />)}
        </g>
      )}
    </g>
  );
};

const ZeroDoors = ({t}) => {
  const a = fade(t, 238, 238.4, 280, 281);
  const open = interpolate(t, [252, 262], [0, 1], clamp);
  const trap = interpolate(t, [262, 268], [0, 1], clamp);
  return (
    <g transform="translate(3550 345)" opacity={a}>
      <g transform={`translate(-120 0) scaleX(${1 - open * 0.78})`}>
        <rect x="-90" y="-165" width="180" height="330" rx="8" fill="#101820" stroke={C.green} strokeWidth="7" />
        <text x="0" y="-35" textAnchor="middle" fill={C.green} fontSize="55" fontWeight="900">0%</text>
        <text x="0" y="20" textAnchor="middle" fill={C.white} fontSize="20" fontWeight="900">INTRO APR</text>
      </g>
      <g transform={`translate(120 0) scaleX(${1 - open * 0.78})`}>
        <rect x="-90" y="-165" width="180" height="330" rx="8" fill="#101820" stroke={C.red} strokeWidth="7" />
        <text x="0" y="-35" textAnchor="middle" fill={C.red} fontSize="55" fontWeight="900">0%*</text>
        <text x="0" y="20" textAnchor="middle" fill={C.white} fontSize="18" fontWeight="900">IF PAID IN FULL</text>
      </g>
      <polygon points={`40,175 230,175 ${205 + trap * 35},${175 + trap * 170} ${65 - trap * 25},${175 + trap * 170}`} fill={trap > 0.02 ? "#2b080a" : "transparent"} stroke={C.red} strokeWidth={trap > 0.02 ? 6 : 0} />
      {trap > 0.25 && [0,1,2,3,4].map((i) => (
        <text key={i} x={85 + i*25} y={235 + i*26*trap} fill={C.red} fontSize="28" fontWeight="900">$</text>
      ))}
    </g>
  );
};

const FinePrintCreature = ({t}) => {
  const a = fade(t, 218, 218.4, 292, 294);
  const x = 3220 + Math.sin(t * 3.2) * 35;
  return (
    <g transform={`translate(${x} 505)`} opacity={a}>
      <rect x="-115" y="-75" width="230" height="130" rx="15" fill="#1b2230" stroke={C.muted} strokeWidth="5" />
      {[-48,-25,-2,21].map((yy) => <line key={yy} x1="-85" x2="85" y1={yy} y2={yy} stroke={C.muted} strokeWidth="3" />)}
      <circle cx="-38" cy="76" r="18" fill={C.white} />
      <circle cx="38" cy="76" r="18" fill={C.white} />
    </g>
  );
};

const Finale = ({t}) => {
  const a = fade(t, 282, 282.2, 306, 306);
  const chop = Math.sin((t - 294) * 12);
  return (
    <g opacity={a}>
      <g transform="translate(3970 420)">
        <rect x="-160" y="0" width="320" height="115" rx="20" fill="#202938" stroke={C.white} strokeWidth="7" />
        <circle cx="-80" cy="-28" r="25" fill="none" stroke={C.green} strokeWidth="6" />
        <circle cx="0" cy="-28" r="25" fill="none" stroke={C.green} strokeWidth="6" />
        <circle cx="80" cy="-28" r="25" fill="none" stroke={C.green} strokeWidth="6" />
        <line x1={-20 + chop*55} y1="-140" x2={80 + chop*55} y2="-10" stroke={C.white} strokeWidth="9" strokeLinecap="round" />
      </g>
      <g transform="translate(4350 370)">
        <rect x="-90" y="-145" width="180" height="290" rx="16" fill="#080a0f" stroke={C.red} strokeWidth="5" />
        <circle cx="-35" cy="-25" r="9" fill={C.red} />
        <circle cx="35" cy="-25" r="9" fill={C.red} />
        <rect x="-60" y="65" width="120" height="60" rx="18" fill="none" stroke={C.white} strokeWidth="5" />
        <text x="0" y="104" textAnchor="middle" fill={C.white} fontSize="24" fontWeight="900">MIN</text>
      </g>
    </g>
  );
};

export const Episode1Motion = ({audioDuration = 306}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rawTime = frame / fps;
  const t = rawTime * (306 / Math.max(1, audioDuration));

  const alexX = tx(t, [0, 28, 64, 100, 130, 160, 190, 220, 248, 282, 306], [300, 600, 980, 1530, 1950, 2300, 2760, 3150, 3420, 3850, 4180]);
  const alexY = 390 + Math.sin(t * 2.1) * 7;
  const walk = t * 5.4;
  const panic = (t > 5.5 && t < 11) || (t > 141 && t < 160) || (t > 259 && t < 274);

  const titleOpacity = fade(t, 9.5, 9.7, 15.5, 16.1);
  const titleScale = 0.7 + 0.3 * spring({frame: frame - Math.round(9.5 * fps), fps, config: {damping: 11, stiffness: 190}});

  const interestA = fade(t, 136, 137, 175, 177);
  const monsterX = tx(t, [136, 150, 165], [2460, 2650, 2760]);

  return (
    <AbsoluteFill style={{backgroundColor: C.bg, overflow: "hidden"}}>
      <Audio src={staticFile("episode1-rebuild-voice.mp3")} volume={1} />
      <CameraRig t={t}>
        <WorldGrid t={t} />
        <svg width="5200" height="820" style={{position: "absolute", left: 0, top: 0}}>
          <line x1="0" y1="585" x2="5100" y2="585" stroke="#273044" strokeWidth="4" />
          <MetalCard t={t} />
          <AnnualFee t={t} />
          <PointsBalloon t={t} />
          <CreditPhone t={t} />
          <Scoreboard t={t} />
          <g opacity={interestA}>
            <InterestMonster x={monsterX} y={390} scale={1.05} grin={1} />
          </g>
          <BonusCart t={t} />
          <FinePrintCreature t={t} />
          <ZeroDoors t={t} />
          <Finale t={t} />

          {/* Rewards trophy physically gets stolen */}
          <g opacity={fade(t, 130, 130.5, 170, 172)} transform="translate(2410 405)">
            <path d="M -55 -70 L 55 -70 L 35 20 Q 0 58 -35 20 Z" fill="#122b12" stroke={C.green} strokeWidth="6" />
            <rect x="-18" y="20" width="36" height="60" fill="none" stroke={C.green} strokeWidth="6" />
            <line x1="-55" y1="-45" x2="-95" y2="-25" stroke={C.green} strokeWidth="6" />
            <line x1="55" y1="-45" x2="95" y2="-25" stroke={C.green} strokeWidth="6" />
            <text x="0" y="-10" textAnchor="middle" fill={C.green} fontSize="31" fontWeight="900">$20</text>
          </g>

          <Alex x={alexX} y={alexY} scale={1.05} pose={walk} face={panic ? "panic" : t > 288 ? "smile" : "neutral"} />
        </svg>

        <div style={{
          position:"absolute",
          left: 0, top: 0, width:1280, height:720,
          display:"flex", alignItems:"center", justifyContent:"center",
          opacity:titleOpacity, transform:`scale(${titleScale})`,
          pointerEvents:"none"
        }}>
          <div style={{fontFamily:"Arial, Helvetica, sans-serif", fontSize:72, fontWeight:1000, color:C.white, textAlign:"center", lineHeight:0.95, textShadow:"0 8px 35px #000"}}>
            YOUR CREDIT CARD<br/><span style={{color:C.yellow}}>HAS DLC</span>
          </div>
        </div>
      </CameraRig>

      {/* Kinetic text overlays, not slides */}
      <KineticCaption t={t} start={0.3} end={4.2} size={31}>Alex has achieved adulthood.</KineticCaption>
      <KineticCaption t={t} start={6.2} end={9.5} color={C.red} size={36}>THEN THE FEE ARRIVES.</KineticCaption>
      <KineticCaption t={t} start={16.2} end={21.5} size={29}>Rewards • Interest • Bonuses • The terrifying little 0% asterisk</KineticCaption>
      <KineticCaption t={t} start={31} end={36} color={C.green}>Spend Alex already planned.</KineticCaption>
      <KineticCaption t={t} start={54} end={59} color={C.yellow} size={42}>30,000 → $210</KineticCaption>
      <KineticCaption t={t} start={89} end={95} color={C.red} size={43}>SAVED: -$5</KineticCaption>
      <KineticCaption t={t} start={113} end={121} color={C.green} size={38}>FREE CARD: +$130 IN THIS EXAMPLE</KineticCaption>
      <KineticCaption t={t} start={128} end={132} color={C.red} size={58}>DEBT.</KineticCaption>
      <KineticCaption t={t} start={151} end={158} color={C.red}>Interest takes the trophy.</KineticCaption>
      <KineticCaption t={t} start={185} end={191} color={C.green} size={48}>$300 BONUS</KineticCaption>
      <KineticCaption t={t} start={211} end={218} color={C.red} size={44}>WINNING BACKWARDS</KineticCaption>
      <KineticCaption t={t} start={239} end={246} color={C.yellow} size={42}>SAME ZERO. DIFFERENT CONDITION.</KineticCaption>
      <KineticCaption t={t} start={263} end={272} color={C.red}>Deferred interest can hide a trapdoor.</KineticCaption>
      <KineticCaption t={t} start={282} end={291} size={34}>Use it • Don’t finance the reward • Don’t invent spending • Read the condition</KineticCaption>
      <KineticCaption t={t} start={294} end={300} color={C.green} size={38}>FINANCIAL EDUCATION COMPLETE.</KineticCaption>
      <KineticCaption t={t} start={300} end={306} color={C.red} size={34}>NEXT: THE MINIMUM PAYMENT HORROR MOVIE</KineticCaption>

      <div style={{
        position:"absolute", left:22, bottom:14, fontFamily:"Arial", fontSize:15,
        fontWeight:800, color:"#566073", letterSpacing:1.2
      }}>
        EPISODE 1 • REVIEW BUILD • PUBLICATION DISABLED
      </div>
    </AbsoluteFill>
  );
};
