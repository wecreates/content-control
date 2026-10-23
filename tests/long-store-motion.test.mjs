import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {matchesLongStore,longStoreTiming,longStorePose,longTrophyTiming,longTrophyPose,longInvoiceCopyPose} from '../remotion/LongStoreMotion.mjs';
const ccsd=JSON.parse(readFileSync(new URL('../projects/long/credit-card-dlc/ccsd.json',import.meta.url)));
const captions=JSON.parse(readFileSync(new URL('../evidence/actual-long/receipts/captions.json',import.meta.url)));
const doc={...ccsd,caption_track:captions},store=longStoreTiming(doc),trophy=longTrophyTiming(doc);
test('targets source gags only, with full store and trophy exchange continuity',()=>{
 const selected=ccsd.scenes.filter(matchesLongStore).map(s=>s.id);
 assert.deepEqual(selected,[...Array.from({length:15},(_,i)=>`scene-${String(41+i).padStart(3,'0')}`),...Array.from({length:12},(_,i)=>`scene-${String(83+i).padStart(3,'0')}`)]);
 assert.equal(matchesLongStore({visual:{action:'interest'}}),false);
});
test('observed words, rather than short storyboard cut boundaries, trigger transfers',()=>{
 assert.equal(store.grasp,99.54);assert.equal(store.stamp,107.3);assert.equal(store.shelf,110.54);
 assert.equal(trophy.take,296.48);assert.equal(trophy.invoice,297.8);assert.equal(trophy.billing,302.18);
 const source=JSON.stringify(doc);longStoreTiming(doc);longTrophyTiming(doc);assert.equal(JSON.stringify(doc),source);
});
test('only one novelty object moves shelf to Dave to shelf, then remains returned',()=>{
 assert.equal(longStorePose(store.grasp-.01,store).objectOwner,'shelf');
 assert.equal(longStorePose(103.6,store).objectOwner,'dave');
 assert.equal(longStorePose(store.shelf+.1,store).objectOwner,'shelf-hand');
 const end=longStorePose(112,store);assert.equal(end.objectOwner,'shelf');assert.equal(end.objectX,865);assert.equal(end.objectY,422);
 for(let t=store.grasp+.01;t<store.shelf;t+=1/240){const p=longStorePose(t,store);assert.equal(p.handX,p.objectX-40);assert.equal(p.handY,p.objectY+15);}
});
test('five-dollar math precedes negative savings stamp; return retires stamp',()=>{
 assert.equal(longStorePose(store.pay-.01,store).payProgress,0);
 assert.equal(longStorePose(store.stamp-.2,store).stampOpacity,0);
 assert.equal(longStorePose(store.stamp+.1,store).stampOpacity,1);
 assert.equal(longStorePose(store.return+.1,store).stampOpacity,0);
});
test('trophy is taken once and invoice stays in Dave hand after handoff',()=>{
 assert.equal(longTrophyPose(trophy.take-.01,trophy).trophyOwner,'dave');
 assert.equal(longTrophyPose(trophy.take+.01,trophy).trophyOwner,'interest');
 assert.equal(longTrophyPose(trophy.invoice-.01,trophy).invoiceOwner,'interest');
 for(const time of [297.8,298.1,298.8,300,302,308]){const p=longTrophyPose(time,trophy);assert.equal(p.invoiceOwner,'dave');assert.equal(p.invoiceX,550);assert.equal(p.invoiceY,400);}
 assert.equal(longTrophyPose(300,trophy).trophyVisible,false);
});
test('one reward contrasts with bounded repeated invoices only on billing dialogue',()=>{
 assert.equal(longTrophyPose(trophy.billing-.01,trophy).copies,0);
 assert.equal(longTrophyPose(trophy.billing+.01,trophy).copies,1);
 assert.equal(longTrophyPose(304,trophy).copies,4);
 assert.equal(longTrophyPose(308,trophy).copies,4);
});
test('all frame states are finite, props stay below caption and headline zones',()=>{
 for(const [start,end,pose,timing] of [[store.start,store.end,longStorePose,store],[trophy.start,trophy.end,longTrophyPose,trophy]]){
  for(let time=start;time<end;time+=1/240){const p=pose(time,timing);for(const value of Object.values(p))if(typeof value==='number')assert.ok(Number.isFinite(value));if('objectY'in p){assert.ok(p.objectY-70>=200);assert.ok(p.objectY+58<=650);}else{assert.ok(p.trophyY-66>=200);assert.ok(p.trophyY+108<=650);assert.ok(p.invoiceY-90*.75>=200);assert.ok(p.invoiceY+92*.75<=650);}}
 }
});
test('physical pose never restarts at intermediate storyboard scene cuts',()=>{
 for(const scene of ccsd.scenes.filter(matchesLongStore)){
  const isTrophy=scene.start>200,pose=isTrophy?longTrophyPose:longStorePose,timing=isTrophy?trophy:store;
  const before=pose(scene.start-1e-5,timing),after=pose(scene.start+1e-5,timing);
  for(const key of isTrophy?['trophyX','trophyY','invoiceX','invoiceY']:['objectX','objectY','daveX'])assert.ok(Math.abs(before[key]-after[key])<.1,`${scene.id}: ${key} jumped`);
 }
});

test('repeated invoices emerge continuously from the original document',()=>{
 for(let index=0;index<4;index++){
  const start=trophy.billing+index*.48,before=longInvoiceCopyPose(index,start,trophy),after=longInvoiceCopyPose(index,start+.42,trophy);
  assert.equal(before.x,550);assert.equal(before.y,400);assert.equal(before.progress,0);
  assert.equal(after.x,672+index*77);assert.equal(after.progress,1);
 }
});
test('SVG server render keeps exactly one physical novelty and uses observed captions',()=>{
 const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const code=buildSync({entryPoints:[new URL('../remotion/LongStorePerformance.jsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text;
 const module={exports:{}};new Function('require','module','exports',code)(require,module,module.exports);
 const {LongStorePerformance}=module.exports;
 const render=time=>renderToStaticMarkup(React.createElement('svg',null,React.createElement(LongStorePerformance,{ccsd:doc,time,scene:doc.scenes.find(s=>time>=s.start&&time<s.end)})));
 for(const time of [92.1,99.7,103.8,107.5,110.7,112.1]){const svg=render(time);assert.equal((svg.match(/data-novelty-object=/g)||[]).length,1);assert.ok(svg.includes('y="73"'));assert.ok(!/NaN|undefined|Infinity/.test(svg));}
 const paid=render(103.8);assert.ok(paid.includes('I pay five.'));assert.ok(paid.includes('data-wallet-state="open-empty"'));
 const transferred=render(297.9);assert.ok(transferred.includes('data-invoice-owner="dave"'));assert.equal((transferred.match(/data-trophy="single-reward"/g)||[]).length,1);
 const payoff=render(304);assert.equal((payoff.match(/data-invoice="repeat"/g)||[]).length,4);assert.equal((payoff.match(/data-one-time-reward=/g)||[]).length,1);assert.equal((payoff.match(/data-trophy="single-reward"/g)||[]).length,0);
 assert.ok(payoff.includes('stroke="none" fill="#D8342C"'));
});

test('camera push-ins preserve the entire fixed art safe region including stroke',()=>{
 for(let time=store.start;time<store.end;time+=1/240){
  const p=longStorePose(time,store),screenY=y=>450+p.cameraOffsetY+(y-450)*p.cameraScale;
  assert.ok(screenY(639.5)<=650);
  if(p.stampOpacity>0){const angle=5*p.stampProgress*Math.PI/180,scale=1+.15*(1-p.stampProgress);const top=304-(165*Math.sin(angle)+44*Math.cos(angle))*scale-3.5*scale;assert.ok(screenY(top)>=200);}
 }
 for(let time=trophy.start;time<trophy.end;time+=1/240){const p=longTrophyPose(time,trophy),screenY=y=>450+p.cameraOffsetY+(y-450)*p.cameraScale;assert.ok(screenY(p.trophyY-68.5)>=200);assert.ok(screenY(639.5)<=650);}
});
