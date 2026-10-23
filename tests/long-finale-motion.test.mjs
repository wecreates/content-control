import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {finaleTiming,finalePose,matchesLongFinale} from '../remotion/LongFinaleMotion.mjs';
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp');}catch{ /* Raster QA is optional in npm-ci environments. */ }
const ccsd=JSON.parse(fs.readFileSync('projects/long/credit-card-dlc/ccsd.json','utf8'));
ccsd.caption_track=JSON.parse(fs.readFileSync('evidence/actual-long/receipts/captions.json','utf8'));
const t=finaleTiming(ccsd);
const buildResult=await build({entryPoints:['remotion/LongFinalePerformance.jsx'],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const {LongFinalePerformance}=await import('data:text/javascript;base64,'+Buffer.from(buildResult.outputFiles[0].text).toString('base64'));
const render=time=>renderToStaticMarkup(React.createElement('svg',{xmlns:'http://www.w3.org/2000/svg',width:1280,height:720,viewBox:'0 0 1280 720'},React.createElement('rect',{width:1280,height:720,fill:'white'}),React.createElement(LongFinalePerformance,{ccsd,time,scene:ccsd.scenes.find(s=>time>=s.start&&time<s.end)})));

test('only the four-rule section and final teaser match, including all narration cuts',()=>{
 assert.equal(ccsd.scenes.filter(matchesLongFinale).length,17);
 assert.equal(matchesLongFinale({story:{visual_gag:'Teaser: minimum payment button in dark hallway'},visual:{label:'THE CALLBACK'}}),false);
 assert.equal(matchesLongFinale(null),false);
 assert.equal(t.start,476.625);assert.equal(t.end,498.75);
 assert.equal(t.teaserStart,514.1666666666666);assert.equal(t.teaserEnd,519.3333333333334);
});

test('observed rule words drive irreversible action state changes',()=>{
 assert.equal(t.rewardChange,481.54);assert.equal(t.rewardUsed,482.44);
 assert.equal(t.carry,486.96);assert.equal(t.wipe,487.78);assert.equal(t.stolen,488.78);
 assert.equal(t.manufacture,492.3);assert.equal(t.spending,493.42);
 assert.equal(t.read,495.56);assert.equal(t.condition,496.28);
 assert.equal(t.button,515.82);assert.equal(t.horror,517.42);
 assert.equal(finalePose(t.rewardChange-.01,t).cart,0);
 assert.equal(finalePose(t.rewardUsed+.1,t).cart,1);
 assert.equal(finalePose(t.rewardUsed+.2,t).yachtOpacity,0);
 assert.equal(finalePose(t.wipe-.01,t).trophyOwner,'dave');
 assert.equal(finalePose(t.stolen+.1,t).trophyOwner,'interest');
 assert.equal(finalePose(t.stolen+.1,t).receiptDelivered,true);
 assert.equal(finalePose(t.manufacture-.01,t).ladderOpacity,0);
 assert.equal(finalePose(t.spending+.1,t).spendingVisible,1);
 assert.equal(finalePose(t.condition+.4,t).reveal,1);
});

test('narration cuts do not restart a yacht conversion, theft, falling ladder or lens inspection',()=>{
 for(let i=1;i<ccsd.scenes.length;i++){
  const scene=ccsd.scenes[i],previous=ccsd.scenes[i-1];
  if(!matchesLongFinale(scene)||!matchesLongFinale(previous)||scene.story.source_beat!==previous.story.source_beat)continue;
  const before=finalePose(scene.start-1e-6,t),after=finalePose(scene.start,t);
  assert.equal(before.kind,after.kind);
  for(const key of Object.keys(before))if(typeof before[key]==='number')assert.ok(Math.abs(before[key]-after[key])<.005,`${scene.id}: ${key} reset`);
 }
});

test('final dark hallway reveals button before eyes; eyes cause trembling and hold until cut',()=>{
 const initial=finalePose(t.teaserStart,t),button=finalePose(516.5,t),eyes=finalePose(518,t),last=finalePose(519.29,t);
 assert.equal(initial.kind,'teaser');assert.equal(initial.eyes,0);assert.equal(initial.button,0);
 assert.equal(button.button,1);assert.equal(button.eyes,0);assert.equal(button.tremble,0);
 assert.equal(eyes.eyes,1);assert.equal(last.eyes,1);assert.equal(last.button,1);
 assert.ok(last.push>initial.push);assert.ok(Math.abs(eyes.tremble)>0);
});

test('all poses are finite, physically contained, and source documents remain unmodified',()=>{
 const before=JSON.stringify(ccsd);
 for(const [start,end] of [[t.start,t.end],[t.teaserStart,t.teaserEnd]])for(let time=start;time<end;time+=1/240){
  const p=finalePose(time,t);
  for(const value of Object.values(p))if(typeof value==='number')assert.ok(Number.isFinite(value));
  if(p.kind==='bonus'){assert.ok(p.ladderY-85>200&&p.ladderY+85<650);assert.ok(p.cartY+76<650);}
  if(p.kind==='terms'){assert.ok(p.lensY-45>200&&p.handY+8<650);}
  if(p.kind==='interest'){assert.ok(p.trophyY-60>200&&p.trophyY+100<650);}
 }
 assert.equal(JSON.stringify(ccsd),before);
});

test('server render uses approved actors, source callbacks, captions and separate headline region',()=>{
 const samples=[477.7,480.5,482.6,485.9,488.9,491.8,493.8,495.5,497,514.3,516.6,518.3,519.29];
 const markers=['four-rule-recap','yacht-to-useful-cart','interest-trophy-theft','bonus-manufactures-spending','read-beside-giant-zero','eyes-trigger-button-tremble'];
 const all=samples.map(render).join('');
 for(const marker of markers)assert.ok(all.includes(marker));
 for(const time of samples){
  const markup=render(time);
  assert.doesNotMatch(markup,/NaN|Infinity|undefined/);
  assert.match(markup,/y="73"[^>]*data-observed-caption="true"/);
  assert.match(markup,/y="155"[^>]*data-finale-headline="true"/);
  assert.doesNotMatch(markup,/LOAN CONTRACT|card-cutting-board-callback|data-kitchen-knife/);
 }
 assert.match(render(480.6),/data-speaking-mouth="true"/);
 assert.doesNotMatch(render(477.7),/data-speaking-mouth="true"/);
 assert.match(render(493.8),/−\$500/);assert.match(render(493.8),/\$300 − \$500 = −\$200/);
 assert.match(render(497),/PROMO END DATE/);assert.match(render(497),/PAYMENT CONDITIONS/);
 const last=render(519.29);assert.match(last,/fill="#090C16"/);assert.match(last,/data-red-eyes="true"/);assert.match(last,/MINIMUM/);assert.match(last,/PAYMENT/);
});

test('representative SVGs rasterize and their art stays out of the caption/headline/bottom safe zones',{skip:!sharp?'Optional sharp is unavailable; motion and server-render tests still run':false},async()=>{
 const dir=process.env.LONG_FINALE_REVIEW_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'long-finale-review-'));
 fs.mkdirSync(dir,{recursive:true});
 const samples=[477.7,480.5,482.6,485.9,488.9,491.8,493.8,495.5,497,514.3,516.6,518.3,519.29];
 const tiles=[];
 for(const [i,time] of samples.entries()){
  const svg=render(time);const png=await sharp(Buffer.from(svg)).png().toBuffer();
  const basename=`${String(i).padStart(2,'0')}-${time.toFixed(2)}`;
  fs.writeFileSync(path.join(dir,`${basename}.svg`),svg);fs.writeFileSync(path.join(dir,`${basename}.png`),png);
  const info=await sharp(png).metadata();assert.equal(info.width,1280);assert.equal(info.height,720);
  // With labels/captions removed, white-stage action pixels must stay in 200–650.
  if(time<t.end){
   const artOnly=svg.replace(/<text[^>]*data-observed-caption="true"[^>]*>[\s\S]*?<\/text>/,'').replace(/<text[^>]*data-finale-headline="true"[^>]*>[\s\S]*?<\/text>/,'');
   const {data,info:raw}=await sharp(Buffer.from(artOnly)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   for(const [lo,hi] of [[0,200],[651,720]])for(let y=lo;y<hi;y++)for(let x=0;x<1280;x++){
    const k=(y*raw.width+x)*raw.channels;assert.ok(data[k]>248&&data[k+1]>248&&data[k+2]>248,`Action outside safe zone at ${time}: ${x},${y}`);
   }
  }
  tiles.push({input:await sharp(png).resize(480,270).toBuffer(),left:(i%3)*480,top:Math.floor(i/3)*270});
 }
 await sharp({create:{width:1440,height:Math.ceil(samples.length/3)*270,channels:3,background:'white'}}).composite(tiles).png().toFile(path.join(dir,'contact-sheet.png'));
 console.log(`Finale raster review: ${dir}`);
});
