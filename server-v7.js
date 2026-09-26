import express from "express";
import {spawn} from "child_process";
import fs from "fs";
import path from "path";
const app=express(),PORT=process.env.PORT||10000,OUT="/tmp/content-control-v7.mp4";
const state={status:"booting",publication:false,logs:[],startedAt:new Date().toISOString()};
const push=(b)=>{const s=b.toString();state.logs.push(s);if(state.logs.length>50)state.logs.shift();};
const render=()=>{
 state.status="rendering";
 const a=["remotion","render","remotion/v7-index.jsx","Episode1V7VerticalProof",OUT,"--codec","h264","--crf","28","--concurrency","1","--video-bitrate","1M"];
 const p=spawn("npx",a,{stdio:["ignore","pipe","pipe"],env:process.env});
 p.stdout.on("data",push);p.stderr.on("data",push);
 p.on("close",(code)=>{state.exitCode=code;state.finishedAt=new Date().toISOString();state.status=code===0&&fs.existsSync(OUT)?"ready":"failed";});
};
app.get("/health",(req,res)=>res.json({...state,logs:state.logs.slice(-12),mediaReady:fs.existsSync(OUT)}));
app.get("/media",(req,res)=>{if(!fs.existsSync(OUT))return res.status(503).json({status:state.status});res.type("video/mp4");res.set("Cache-Control","public, max-age=3600");fs.createReadStream(OUT).pipe(res);});
app.get("/watch",(req,res)=>res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Content Control V7</title><style>body{margin:0;background:#111;color:white;font-family:Arial;display:grid;place-items:center;min-height:100vh}main{width:min(92vw,430px);text-align:center}video{width:100%;max-height:86vh;background:#000;border-radius:18px}a{color:#fff}.s{opacity:.7;font-size:13px;margin:10px}</style><main><h2>Episode 1 • V7 Proof</h2>${state.status==="ready"?'<video controls playsinline preload="metadata" src="/media"></video>':`<p>Render status: ${state.status}</p><script>setTimeout(()=>location.reload(),8000)</script>`}<div class="s">Publication disabled • private review proof</div></main>`));
app.get("/",(req,res)=>res.redirect("/watch"));
app.listen(PORT,()=>{console.log("V7 proof server",PORT);setTimeout(render,1200);});
