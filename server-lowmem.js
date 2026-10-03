import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";

const app=express();
const PORT=Number(process.env.PORT||10000);
const output=path.resolve("public-review/episode1-v10-free.mp4");
const healthPath=path.resolve("state/content-control-health.json");
const captionHealthPath=path.resolve("state/caption-health.json");
const captionsPath=path.resolve("public-review/episode1-v10-free.vtt");
const episode2Output=path.resolve("public-review/episode2-coupon-book.mp4");
const episode2HealthPath=path.resolve("state/episode2-health.json");
const episode3Output=path.resolve("public-review/episode3-cashback-casino.mp4");
const episode3HealthPath=path.resolve("state/episode3-health.json");
const episode3CaptionsPath=path.resolve("public-review/episode3-cashback-casino.vtt");
const referenceCloneOutput=path.resolve("public-review/reference-clone-proof.mp4");
const referenceCloneHealthPath=path.resolve("state/reference-clone-health.json");
const v2Output=path.resolve("public-review/v2-boss-fight.mp4");
const v2HealthPath=path.resolve("state/v2-health.json");
fs.mkdirSync(path.dirname(output),{recursive:true});

const renderState={status:"booting",logs:[]};
let v2TickRunning=false;
function runV2Tick(){
  if(v2TickRunning)return;
  v2TickRunning=true;renderState.status="v2-tick-running";
  const p=spawn("python",["scripts/v2_runtime_tick.py"],{env:{...process.env,PUBLICATION_ENABLED:"false"}});
  p.stdout.on("data",d=>renderState.logs.push(String(d).trim()));
  p.stderr.on("data",d=>renderState.logs.push(String(d).trim()));
  p.on("close",code=>{renderState.status=code===0?"v2-tick-ok":"v2-tick-failed";v2TickRunning=false;});
}
function readJson(p){try{return JSON.parse(fs.readFileSync(p,"utf8"));}catch{return null;}}
function readHealth(){return readJson(healthPath);}
function readCaptionHealth(){return readJson(captionHealthPath);}
function fileHash(p){
  if(!fs.existsSync(p)) return null;
  const h=crypto.createHash("sha256");
  const fd=fs.openSync(p,"r");
  try{
    const buf=Buffer.allocUnsafe(1024*1024);
    let n=0;
    while((n=fs.readSync(fd,buf,0,buf.length,null))>0) h.update(buf.subarray(0,n));
  }finally{fs.closeSync(fd);}
  return h.digest("hex");
}
function episode2Acceptance(){
  const h=readJson(episode2HealthPath);
  const actual=fileHash(episode2Output);
  const expected=h?.candidate_sha256||null;
  const ready=Boolean(h?.status==="GREEN"&&h?.publication_enabled===false&&actual&&expected&&actual===expected);
  return {health:h,actual,expected,ready};
}
function episode3Acceptance(){
  const h=readJson(episode3HealthPath);
  const actual=fileHash(episode3Output);
  const expected=h?.candidate_sha256||null;
  const captionHash=fs.existsSync(episode3CaptionsPath)?fileHash(episode3CaptionsPath):null;
  const publicationLocked=h?.publication_enabled===false;
  const captionReady=Boolean(publicationLocked&&h?.status==="GREEN"&&expected&&h?.caption_sha256&&captionHash===h.caption_sha256&&fs.existsSync(episode3CaptionsPath));
  const videoReady=Boolean(h?.status==="GREEN"&&publicationLocked&&actual&&expected&&actual===expected);
  const ready=videoReady&&captionReady;
  return {health:h,actual,expected,captionHash,captionReady,videoReady,ready};
}
function v2Acceptance(){
  const h=readJson(v2HealthPath);
  const actual=fileHash(v2Output),expected=h?.candidate_sha256||null;
  const ready=Boolean(h?.status==="READY"&&h?.publication_enabled===false&&h?.creative_qa===true&&h?.technical_qa===true&&h?.visual_parity_qa===true&&actual&&expected&&actual===expected);
  return {health:h,actual,expected,ready};
}
function referenceCloneAcceptance(){
  const h=readJson(referenceCloneHealthPath);
  const actual=fileHash(referenceCloneOutput);
  const expected=h?.candidate_sha256||null;
  const ready=Boolean(h?.status==="CLONE_PROOF_GREEN"&&h?.publication_enabled===false&&actual&&expected&&actual===expected);
  return {health:h,actual,expected,ready};
}
function acceptance(){
  const h=readHealth();
  const c=readCaptionHealth();
  const actual=fileHash(output);
  const expected=h?.candidate_sha256||null;
  const captionHash=fs.existsSync(captionsPath)?fileHash(captionsPath):null;
  const captionReady=Boolean(
    c?.status==="PASS" &&
    c?.publication_enabled===false &&
    c?.candidate_sha256===expected &&
    c?.caption_sha256===captionHash &&
    fs.existsSync(captionsPath)
  );
  const videoReady=Boolean(h?.status==="GREEN"&&h?.publication_enabled===false&&actual&&expected&&actual===expected);
  const ready=videoReady&&captionReady;
  return {health:h,captionHealth:c,captionHash,actual,expected,videoReady,captionReady,ready};
}
app.disable("x-powered-by");
app.use((req,res,next)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy","same-origin");
  next();
});

app.get("/",(req,res)=>{
  const canonical=acceptance();
  const ep3=episode3Acceptance();
  const clone=referenceCloneAcceptance();
  const latest=clone.ready?"/clone/watch":ep3.ready?"/episode3/watch":canonical.ready?"/watch":null;
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Content Control Review</title><style>html{background:#fff;color-scheme:light}body{margin:0;background:#fff;color:#111;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:20px;box-sizing:border-box}main{max-width:560px;margin:0 auto}.card{border:1px solid #ddd;border-radius:16px;padding:20px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.06)}a{display:inline-block;padding:12px 16px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-weight:700}.muted{color:#666}.ok{color:#08783f;font-weight:700}.wait{color:#8a5a00;font-weight:700}</style></head><body><main><div class="card"><h1>Content Control Review</h1><p class="${latest?'ok':'wait'}">${latest?'Verified review is ready.':'No verified review is ready yet.'}</p><p class="muted">This page stays visible during cold starts and deployment propagation. Publication is disabled.</p>${latest?`<a href="${latest}">Open latest verified video</a>`:'<p>QA/render pipeline is still working.</p>'}</div></main></body></html>`);
});

app.get("/latest",(req,res)=>{
  const ep3=episode3Acceptance();
  if(ep3.ready) return res.redirect(302,"/episode3/watch");
  const canonical=acceptance();
  if(canonical.ready) return res.redirect(302,"/watch");
  res.setHeader("Cache-Control","no-store");
  return res.status(503).type("html").send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{background:#fff;color:#111;font-family:system-ui}body{padding:24px}</style><h2>No verified video is ready yet.</h2><p>The review service is online and publication is disabled.</p>');
});

app.get("/health",(req,res)=>{
  const a=acceptance();
  res.setHeader("Cache-Control","no-store");
  res.status(a.ready?200:503).json({
    ok:a.ready,
    engine:"remotion-v10-free",
    publication:false,
    qaStatus:a.health?.status||"missing",
    expectedSha256:a.expected,
    actualSha256:a.actual,
    hashBound:a.actual!==null&&a.actual===a.expected,
    captionReady:a.captionReady,
    captionSha256:a.captionHash,
    captionCandidateSha256:a.captionHealth?.candidate_sha256||null,
    renderStatus:renderState.status
  });
});

app.get("/status",(req,res)=>{
  const a=acceptance();
  res.setHeader("Cache-Control","no-store");
  res.json({
    id:"episode1-v10-free",
    ready:a.ready,
    publication:false,
    qaStatus:a.health?.status||"missing",
    expectedSha256:a.expected,
    actualSha256:a.actual,
    watchUrl:a.ready?"/watch":null,
    captionsUrl:a.captionReady?"/captions":null,
    renderStatus:renderState.status,
    logs:renderState.logs.slice(-20)
  });
});

app.get("/media",(req,res)=>{
  const a=acceptance();
  if(!a.ready){
    res.setHeader("Cache-Control","no-store");
    return res.status(409).json({error:"accepted artifact unavailable or hash mismatch",publication:false});
  }
  const stat=fs.statSync(output);
  const total=stat.size;
  const range=req.headers.range;
  res.setHeader("Accept-Ranges","bytes");
  res.setHeader("ETag",`"${a.expected}"`);
  res.setHeader("Cache-Control","public, max-age=31536000, immutable");
  res.setHeader("Content-Type","video/mp4");

  if(range){
    const m=/bytes=(\d*)-(\d*)/.exec(String(range));
    if(!m) return res.status(416).setHeader("Content-Range",`bytes */${total}`).end();
    let start=m[1]?Number(m[1]):0;
    let end=m[2]?Number(m[2]):total-1;
    if(!m[1]&&m[2]){
      const suffix=Number(m[2]);
      start=Math.max(0,total-suffix);
      end=total-1;
    }
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=total){
      return res.status(416).setHeader("Content-Range",`bytes */${total}`).end();
    }
    end=Math.min(end,total-1);
    res.status(206);
    res.setHeader("Content-Range",`bytes ${start}-${end}/${total}`);
    res.setHeader("Content-Length",String(end-start+1));
    return fs.createReadStream(output,{start,end}).pipe(res);
  }
  res.setHeader("Content-Length",String(total));
  fs.createReadStream(output).pipe(res);
});

app.get("/captions",(req,res)=>{
  const a=acceptance();
  if(!a.captionReady){
    res.setHeader("Cache-Control","no-store");
    return res.status(409).json({error:"verified captions unavailable",publication:false});
  }
  const tag=a.captionHash;
  res.setHeader("Content-Type","text/vtt; charset=utf-8");
  res.setHeader("Cache-Control","public, max-age=31536000, immutable");
  res.setHeader("ETag",`"${tag}"`);
  fs.createReadStream(captionsPath).pipe(res);
});


function streamMp4(req,res,file,etag){
  const stat=fs.statSync(file);
  const total=stat.size;
  const range=req.headers.range;
  res.setHeader("Accept-Ranges","bytes");
  res.setHeader("ETag",`"${etag}"`);
  res.setHeader("Cache-Control","public, max-age=31536000, immutable");
  res.setHeader("Content-Type","video/mp4");
  if(range){
    const m=/bytes=(\d*)-(\d*)/.exec(String(range));
    if(!m) return res.status(416).setHeader("Content-Range",`bytes */${total}`).end();
    let start=m[1]?Number(m[1]):0;
    let end=m[2]?Number(m[2]):total-1;
    if(!m[1]&&m[2]){const suffix=Number(m[2]);start=Math.max(0,total-suffix);end=total-1;}
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=total){
      return res.status(416).setHeader("Content-Range",`bytes */${total}`).end();
    }
    end=Math.min(end,total-1);
    res.status(206);
    res.setHeader("Content-Range",`bytes ${start}-${end}/${total}`);
    res.setHeader("Content-Length",String(end-start+1));
    return fs.createReadStream(file,{start,end}).pipe(res);
  }
  res.setHeader("Content-Length",String(total));
  fs.createReadStream(file).pipe(res);
}

app.get("/episode2/health",(req,res)=>{
  const a=episode2Acceptance();
  res.setHeader("Cache-Control","no-store");
  res.status(a.ready?200:503).json({
    ok:a.ready,
    id:"episode2-coupon-book",
    publication:false,
    qaStatus:a.health?.status||"missing",
    expectedSha256:a.expected,
    actualSha256:a.actual,
    hashBound:a.actual!==null&&a.actual===a.expected
  });
});

app.get("/episode2/media",(req,res)=>{
  const a=episode2Acceptance();
  if(!a.ready){
    res.setHeader("Cache-Control","no-store");
    return res.status(409).json({error:"Episode 2 accepted artifact unavailable or hash mismatch",publication:false});
  }
  return streamMp4(req,res,episode2Output,a.expected);
});

app.get("/episode2/watch",(req,res)=>{
  const a=episode2Acceptance();
  const short=(a.expected||"unverified").slice(0,12);
  const body=a.ready
    ? '<video controls playsinline preload="metadata" src="/episode2/media"></video>'
    : '<p>Episode 2 is still in QA. This page will activate only after the exact artifact is accepted.</p><script>setTimeout(()=>location.reload(),5000)</script>';
  res.setHeader("Cache-Control","no-store");
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content Control — Episode 2</title><style>html{background:#fff;color-scheme:light}body{margin:0;background:#fff;color:#111;font-family:system-ui;padding:16px}main{max-width:560px;margin:auto}video{display:block;width:100%;max-height:90vh;background:#f5f5f5;border:1px solid #dedede;border-radius:14px}small{color:#666}</style><main><h2>Your Credit Card Became a Coupon Book</h2>${body}<p><small>EPISODE 2 • hash ${short} • publication disabled</small></p></main>`);
});

app.get("/episode3/health",(req,res)=>{
  const a=episode3Acceptance();
  res.setHeader("Cache-Control","no-store");
  res.status(a.ready?200:503).json({ok:a.ready,id:"episode3-cashback-casino",publication:false,qaStatus:a.health?.status||"missing",expectedSha256:a.expected,actualSha256:a.actual,hashBound:a.actual!==null&&a.actual===a.expected,captionReady:a.captionReady,captionSha256:a.captionHash});
});
app.get("/episode3/media",(req,res)=>{
  const a=episode3Acceptance();
  if(!a.videoReady){res.setHeader("Cache-Control","no-store");return res.status(409).json({error:"Episode 3 accepted artifact unavailable or hash mismatch",publication:false});}
  return streamMp4(req,res,episode3Output,a.expected);
});
app.get("/episode3/captions",(req,res)=>{
  const a=episode3Acceptance();
  if(!a.captionReady){res.setHeader("Cache-Control","no-store");return res.status(409).json({error:"Episode 3 verified captions unavailable",publication:false});}
  res.setHeader("Content-Type","text/vtt; charset=utf-8");
  res.setHeader("Cache-Control","public, max-age=31536000, immutable");
  res.setHeader("ETag",`"${a.captionHash}"`);
  fs.createReadStream(episode3CaptionsPath).pipe(res);
});
app.get("/episode3/watch",(req,res)=>{
  const a=episode3Acceptance();
  const short=(a.expected||"unverified").slice(0,12);
  const ready=Boolean(a.ready);
  const body=ready
    ? '<div class="player-wrap"><div id="loadingCard" class="loading-card"><div class="spinner"></div><strong>Loading verified video…</strong><span style="margin-top:8px;color:#666">The page will stay visible while media buffers.</span></div><video id="player" controls playsinline preload="metadata" poster="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22720%22 height=%221280%22%3E%3Crect width=%22720%22 height=%221280%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%22360%22 y=%22640%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2240%22 fill=%22%23666%22%3ELoading video…%3C/text%3E%3C/svg%3E" src="/episode3/media"><track kind="captions" src="/episode3/captions" srclang="en" label="English" default></video></div><p id="status">Checking media…</p>'
    : '<section class="pending"><div class="spinner"></div><h3>Video is not ready yet.</h3><p>The review page is working, but the Episode 3 render has not passed hash-bound QA yet.</p><p><a href="/watch">Open the last verified video</a></p></section>';
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("Pragma","no-cache");
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Content Control — Cashback Casino</title><style>
  html{background:#fff;color-scheme:light}html,body{min-height:100%;background:#fff;color:#111}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px;box-sizing:border-box}main{max-width:560px;margin:0 auto}h2{font-size:22px;line-height:1.2;margin:8px 0 14px}.player-wrap{position:relative;width:100%;aspect-ratio:9/16;max-height:82vh;background:#f5f5f5;border:1px solid #dedede;border-radius:14px;overflow:hidden}.player-wrap video{display:block;width:100%;height:100%;object-fit:contain;background:#f5f5f5}.loading-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;color:#111;z-index:2}.loading-card.hidden{display:none}.pending{min-height:58vh;border:1px solid #dedede;border-radius:14px;padding:28px 20px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:#fff}.pending p{max-width:36ch;color:#555}.spinner{width:38px;height:38px;border:4px solid #ddd;border-top-color:#111;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px}@keyframes spin{to{transform:rotate(360deg)}}a{color:#075ea8}small{color:#666}#status{color:#666;font-size:14px}
  </style></head><body><main><h2>2% Cashback Turned Dave's Brain Into a Casino</h2>${body}<p><small>ENTERTAINMENT-FIRST • hash ${short} • publication disabled</small></p></main>
  <script>
  const v=document.getElementById('player'),s=document.getElementById('status');
  if(v&&s){const card=document.getElementById('loadingCard');const hide=()=>{if(card)card.classList.add('hidden')};v.addEventListener('loadeddata',()=>{hide();s.textContent='Verified video ready.'});v.addEventListener('playing',()=>{hide();s.textContent='Playing verified candidate.'});v.addEventListener('error',()=>{if(card){card.innerHTML='<strong>Video failed to load.</strong><span style="margin-top:8px;color:#666">The page is still working. Try refresh once.</span>'}s.textContent='Media unavailable; page stayed visible.'});setTimeout(()=>{if(v.readyState>=2)hide()},1200);}
  </script></body></html>`);
});
app.post("/v2/run",(req,res)=>{
  if(v2TickRunning)return res.status(202).json({ok:true,status:"already-running",publication:false});
  runV2Tick();
  return res.status(202).json({ok:true,status:"started",publication:false});
});
app.get("/v2/runtime",(req,res)=>{res.setHeader("Cache-Control","no-store");res.json({status:renderState.status,running:v2TickRunning,logs:renderState.logs.slice(-40),publication:false});});
app.get("/v2/health",(req,res)=>{
  const a=v2Acceptance();res.setHeader("Cache-Control","no-store");
  res.status(a.ready?200:503).json({ok:a.ready,id:"content-control-v2",publication:false,qaStatus:a.health?.status||"missing",creativeQa:a.health?.creative_qa===true,technicalQa:a.health?.technical_qa===true,visualParityQa:a.health?.visual_parity_qa===true,expectedSha256:a.expected,actualSha256:a.actual,watchUrl:a.ready?"/v2/watch":null});
});
app.get("/v2/media",(req,res)=>{const a=v2Acceptance();if(!a.ready)return res.status(409).json({error:"V2 is not READY",publication:false});return streamMp4(req,res,v2Output,a.expected);});
app.get("/v2/watch",(req,res)=>{
 const a=v2Acceptance();res.setHeader("Cache-Control","no-store");
 const body=a.ready?'<video controls playsinline preload="metadata" src="/v2/media"></video>':'<p>V2 has not passed the complete production contract yet.</p>';
 res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{background:#fff;color:#111;font-family:system-ui}body{padding:16px}main{max-width:560px;margin:auto}video{width:100%;max-height:90vh;background:#f5f5f5;border-radius:14px}</style><main><h2>Content Control V2</h2>${body}<p>Publication disabled</p></main>`);
});
app.get("/clone/health",(req,res)=>{
  const a=referenceCloneAcceptance();res.setHeader("Cache-Control","no-store");
  res.status(a.ready?200:503).json({ok:a.ready,id:"reference-clone-proof",publication:false,qaStatus:a.health?.status||"missing",expectedSha256:a.expected,actualSha256:a.actual,hashBound:a.actual!==null&&a.actual===a.expected,referenceId:a.health?.reference_id||null});
});
app.get("/clone/media",(req,res)=>{
  const a=referenceCloneAcceptance();if(!a.ready){res.setHeader("Cache-Control","no-store");return res.status(409).json({error:"clone proof unavailable or hash mismatch",publication:false});}
  return streamMp4(req,res,referenceCloneOutput,a.expected);
});
app.get("/clone/watch",(req,res)=>{
  const a=referenceCloneAcceptance();const short=(a.expected||"unverified").slice(0,12);
  const body=a.ready?'<video controls playsinline preload="metadata" src="/clone/media"></video>':'<section class="pending"><h3>Clone proof is not ready yet.</h3><p>The page remains available while QA/rendering completes.</p></section>';
  res.setHeader("Cache-Control","no-store, max-age=0");res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content Control Clone Review</title><style>html,body{background:#fff;color:#111;font-family:system-ui}body{padding:16px}main{max-width:560px;margin:auto}video{width:100%;background:#f5f5f5;border:1px solid #ddd;border-radius:14px}.pending{min-height:55vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px solid #ddd;border-radius:14px}small{color:#666}</style><main><h2>Reference Clone Proof</h2>${body}<p><small>hash ${short} • publication disabled</small></p></main>`);
});
app.get("/watch",(req,res)=>{
  const a=acceptance();
  const short=(a.expected||"unverified").slice(0,12);
  const body=a.ready
    ? '<video controls playsinline preload="metadata" src="/media"><track kind="captions" src="/captions" srclang="en" label="English" default></video>'
    : '<p>Accepted artifact is not ready. Repair pipeline required.</p><script>setTimeout(()=>location.reload(),5000)</script>';
  res.setHeader("Cache-Control","no-store");
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content Control Review</title><style>html{background:#fff;color-scheme:light}body{margin:0;background:#fff;color:#111;font-family:system-ui;padding:16px}main{max-width:560px;margin:auto}video{display:block;width:100%;max-height:90vh;background:#f5f5f5;border:1px solid #dedede;border-radius:14px}small{color:#666}</style><main><h2>Content Control Review</h2>${body}<p><small>FREE_QA • hash ${short} • publication disabled</small></p></main>`);
});

app.use((req,res)=>res.status(404).json({error:"not found",publication:false}));

const server=app.listen(PORT,()=>{
  console.log("hash-bound V10 free review worker listening",PORT);
  runV2Tick();
  setInterval(runV2Tick,15*60*1000).unref();
  const a=acceptance();
  if(!fs.existsSync(output)){
    console.error("Canonical review artifact missing; fail-closed until CI restores an accepted artifact");
  }else if(!a.ready){
    console.error("Review artifact exists but is not accepted by canonical health state");
  }
});

function shutdown(signal){
  console.log("shutdown",signal);
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(1),8000).unref();
}
process.on("SIGTERM",()=>shutdown("SIGTERM"));
process.on("SIGINT",()=>shutdown("SIGINT"));
