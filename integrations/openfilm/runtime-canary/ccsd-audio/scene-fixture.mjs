// Original, bounded test art. These selected scenes are test approval only.
export const sceneTypes=['title-reveal','caption-change','vector-diagram','camera-pan'];
export const cues=[.25,1.25,2.25,3.25];
export function fixtureHTML({missingAudio=false}={}){
 return `<!doctype html><html><head><meta charset="utf-8">
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
 <style>html,body{margin:0;background:#17212c;color:white;font-family:Arial;overflow:hidden}
 #stage{position:absolute;left:40px;top:30px;width:240px;height:120px}
 section{position:absolute;inset:0;display:none}h1{font-size:25px}p{font-size:20px}
 #cue{position:absolute;left:0;top:0;width:16px;height:16px;background:black}
 </style></head><body><div id="stage">
 <section id="title-reveal"><h1>Original idea</h1></section>
 <section id="caption-change"><p id="caption"></p></section>
 <section id="vector-diagram"><svg width="240" height="120"><path d="M30 60H210" stroke="white"/>
 <circle cx="30" cy="60" r="16" fill="#ec934b"/><circle id="dot" cx="120" cy="60" r="14" fill="#54d9c1"/>
 <circle cx="210" cy="60" r="16" fill="#ec934b"/></svg></section>
 <section id="camera-pan"><div id="pan" style="width:180px;height:70px;background:#546acc"><p>Original landscape</p></div></section>
 </div><div id="cue"></div><script>
 const types=${JSON.stringify(sceneTypes)},cues=${JSON.stringify(cues)};
 // Pinned upstream internal test hook. This does not extend the CCSD adapter.
 window.__filmSounds=()=>cues.map((at,i)=>({src:${JSON.stringify(missingAudio?'absent.wav':'tone.wav')},at,from:.1,to:.35,volume:i===1?.5:1}));
 window.film={width:320,height:180,duration:4,frame(t){
  if(!Number.isFinite(t)||t<0||t>=4)throw Error('Invalid time');
  const i=Math.floor(t),u=t-i;
  for(const [j,id] of types.entries())document.getElementById(id).style.display=j===i?'block':'none';
  document.getElementById('title-reveal').style.transform='translateY('+ (12*(1-u))+'px)';
  document.getElementById('title-reveal').style.opacity=String(.3+.7*u);
  document.getElementById('caption').textContent=u<.5?'A seed of an idea':'An idea takes shape';
  document.getElementById('dot').setAttribute('cx',String(55+130*u));
  document.getElementById('pan').style.transform='translateX('+ (40*u)+'px)';
  document.getElementById('cue').style.background=cues.some(c=>t>=c&&t<c+.25)?'white':'black';
 }};
 </script></body></html>`;
}
