// Run from content-control checkout with its installed @remotion/renderer.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const {openBrowser}=await import(pathToFileURL(root+'/node_modules/@remotion/renderer/dist/esm/index.mjs'));
const {fitCaption}=await import(pathToFileURL(root+'/remotion/StudioLayout.mjs'));
const source=process.argv[2]||'state/visual-analysis/repair-evidence/observed-captions.json';
const track=JSON.parse(fs.readFileSync(source));
const cues=track.cues.map(c=>({...c,layout:fitCaption(c.text,592,175,72)}));
const b=await openBrowser('chrome');
try{
 const p=await b.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
 const results=await p.evaluate((cues)=>cues.map(c=>{
  const l=c.layout;
  document.body.innerHTML=`<svg width="720" height="1280" viewBox="0 0 720 1280"><text x="360" y="230" text-anchor="middle" font-family="Arial Black,Arial,DejaVu Sans,sans-serif" font-weight="900" font-size="${l.size}" fill="#111" stroke="#111" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke">${l.lines.map((line,i)=>`<tspan x="360" dy="${i?l.lineHeight:0}">${line.replaceAll('&','&amp;').replaceAll('<','&lt;')}</tspan>`).join('')}</text></svg>`;
  const r=document.querySelector('text').getBBox();
  return {text:c.text,start:c.start,end:c.end,scene:c.scene_id,size:l.size,lines:l.lines.length,left:r.x-.6,right:r.x+r.width+.6,top:r.y-.6,bottom:r.y+r.height+.6};
 }),cues);
 const receipt={scope:'Local Chromium SVG glyph bounds of all hosted observed cues; not full video or competitor approval',publication_enabled:false,source,production_font_family:'Arial Black,Arial,DejaVu Sans,sans-serif',font_weight:900,stroke_width:1.2,cueCount:results.length,minimumSize:Math.min(...results.map(r=>r.size)),maximumBottom:Math.max(...results.map(r=>r.bottom)),minimumTop:Math.min(...results.map(r=>r.top)),minimumLeft:Math.min(...results.map(r=>r.left)),maximumRight:Math.max(...results.map(r=>r.right)),clipped:results.filter(r=>r.left<64||r.right>656||r.top<0||r.bottom>1280),cues:results};
 receipt.status=receipt.clipped.length?'FAIL':'PASS';
 fs.writeFileSync(process.argv[3]||'/tmp/observed-caption-bounds-receipt.json',JSON.stringify(receipt,null,2)+'\n');
}finally{await b.close({silent:true});}
