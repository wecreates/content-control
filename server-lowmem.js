import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const app=express();
const PORT=Number(process.env.PORT||10000);
const output=path.resolve("public-review/episode1-v10-free.mp4");
const healthPath=path.resolve("state/content-control-health.json");
const captionHealthPath=path.resolve("state/caption-health.json");
const captionsPath=path.resolve("public-review/episode1-v10-free.vtt");
const episode2Output=path.resolve("public-review/episode2-coupon-book.mp4");
const episode2HealthPath=path.resolve("state/episode2-health.json");
fs.mkdirSync(path.dirname(output),{recursive:true});

const renderState={status:"repository-artifact-only"};
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
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content Control — Episode 2</title><style>body{margin:0;background:#090b0f;color:#f4f1e9;font-family:system-ui;padding:16px}main{max-width:560px;margin:auto}video{width:100%;max-height:90vh;background:#000;border-radius:14px}small{color:#8fa0b2}</style><main><h2>Your Credit Card Became a Coupon Book</h2>${body}<p><small>EPISODE 2 • hash ${short} • publication disabled</small></p></main>`);
});

app.get("/watch",(req,res)=>{
  const a=acceptance();
  const short=(a.expected||"unverified").slice(0,12);
  const body=a.ready
    ? '<video controls playsinline preload="metadata" src="/media"><track kind="captions" src="/captions" srclang="en" label="English" default></video>'
    : '<p>Accepted artifact is not ready. Repair pipeline required.</p><script>setTimeout(()=>location.reload(),5000)</script>';
  res.setHeader("Cache-Control","no-store");
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content Control Review</title><style>body{margin:0;background:#090b0f;color:#f4f1e9;font-family:system-ui;padding:16px}main{max-width:560px;margin:auto}video{width:100%;max-height:90vh;background:#000;border-radius:14px}small{color:#8fa0b2}</style><main><h2>Content Control Review</h2>${body}<p><small>FREE_QA • hash ${short} • publication disabled</small></p></main>`);
});

app.use((req,res)=>res.status(404).json({error:"not found",publication:false}));

const server=app.listen(PORT,()=>{
  console.log("hash-bound V10 free review worker listening",PORT);
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
