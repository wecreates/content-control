import express from "express";
import {spawn} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const app=express();
const PORT=process.env.PORT||10000;
const output=path.resolve("public-review/episode1-v10-free.mp4");
const healthPath=path.resolve("state/content-control-health.json");
fs.mkdirSync(path.dirname(output),{recursive:true});

let renderState={status:"idle",startedAt:null,finishedAt:null,exitCode:null,logs:[]};

function push(x){renderState.logs.push(String(x));if(renderState.logs.length>100)renderState.logs.shift();}
function readHealth(){
  try{return JSON.parse(fs.readFileSync(healthPath,"utf8"));}catch{return null;}
}
function fileHash(p){
  if(!fs.existsSync(p)) return null;
  const h=crypto.createHash("sha256");
  h.update(fs.readFileSync(p));
  return h.digest("hex");
}
function acceptance(){
  const h=readHealth();
  const actual=fileHash(output);
  const expected=h?.candidate_sha256||null;
  const green=h?.status==="GREEN";
  const publicationOff=h?.publication_enabled===false;
  return {health:h,actual,expected,ready:Boolean(green&&publicationOff&&actual&&expected&&actual===expected)};
}
function render(){
  if(renderState.status==="rendering") return;
  renderState={status:"rendering",startedAt:new Date().toISOString(),finishedAt:null,exitCode:null,logs:[]};
  const args=["remotion","render","remotion/v10-index.jsx","Episode1V10FinalProof",output,"--codec","h264","--crf","25","--concurrency","1"];
  const child=spawn("npx",args,{stdio:["ignore","pipe","pipe"],env:process.env});
  child.stdout.on("data",b=>push(b.toString()));
  child.stderr.on("data",b=>push(b.toString()));
  child.on("close",code=>{
    renderState.status=code===0&&fs.existsSync(output)?"rendered":"failed";
    renderState.exitCode=code;
    renderState.finishedAt=new Date().toISOString();
  });
}

app.get("/health",(req,res)=>{
  const a=acceptance();
  res.status(a.ready?200:503).json({
    ok:a.ready,
    engine:"remotion-v10-free",
    publication:false,
    qaStatus:a.health?.status||"missing",
    expectedSha256:a.expected,
    actualSha256:a.actual,
    hashBound:a.actual!==null&&a.actual===a.expected,
    renderStatus:renderState.status
  });
});

app.get("/status",(req,res)=>{
  const a=acceptance();
  res.json({
    id:"episode1-v10-free",
    ready:a.ready,
    publication:false,
    qaStatus:a.health?.status||"missing",
    expectedSha256:a.expected,
    actualSha256:a.actual,
    watchUrl:a.ready?"/watch":null,
    renderStatus:renderState.status,
    logs:renderState.logs.slice(-20)
  });
});

app.get("/media",(req,res)=>{
  const a=acceptance();
  if(!a.ready) return res.status(409).json({error:"accepted artifact unavailable or hash mismatch",publication:false});
  res.type("video/mp4").sendFile(output);
});

app.get("/watch",(req,res)=>{
  const a=acceptance();
  const short=(a.expected||"unverified").slice(0,12);
  const body=a.ready
    ? '<video controls playsinline preload="metadata" src="/media"></video>'
    : '<p>Accepted artifact is not ready. Repair pipeline required.</p><script>setTimeout(()=>location.reload(),5000)</script>';
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content Control Review</title><style>body{margin:0;background:#090b0f;color:#f4f1e9;font-family:system-ui;padding:16px}main{max-width:560px;margin:auto}video{width:100%;max-height:90vh;background:#000;border-radius:14px}small{color:#8fa0b2}</style><main><h2>Content Control Review</h2>${body}<p><small>FREE_QA • hash ${short} • publication disabled</small></p></main>`);
});

app.listen(PORT,()=>{
  console.log("hash-bound V10 free review worker listening",PORT);
  const a=acceptance();
  if(!fs.existsSync(output)){
    console.log("Canonical review artifact missing; starting local V10 render");
    setTimeout(render,1000);
  } else if(!a.ready){
    console.error("Review artifact exists but is not accepted by canonical health state");
  }
});
