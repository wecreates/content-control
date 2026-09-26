import express from "express";
import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const app=express();
const PORT=process.env.PORT||10000;
const outDir=path.resolve("review-output");
fs.mkdirSync(outDir,{recursive:true});
const id="episode1-v9-latest";
const output=path.join(outDir,id+".mp4");
let state={status:fs.existsSync(output)?"ready":"starting",startedAt:null,finishedAt:null,exitCode:null,logs:[]};

function push(x){state.logs.push(String(x));if(state.logs.length>100)state.logs.shift();}
function render(){
  if(state.status==="rendering") return;
  state={status:"rendering",startedAt:new Date().toISOString(),finishedAt:null,exitCode:null,logs:[]};
  const args=["remotion","render","remotion/v9-index.jsx","Episode1V9VerticalProof",output,"--codec","h264","--crf","28","--concurrency","1","--scale","0.5"];
  const child=spawn("npx",args,{stdio:["ignore","pipe","pipe"],env:process.env});
  child.stdout.on("data",b=>push(b.toString()));
  child.stderr.on("data",b=>push(b.toString()));
  child.on("close",code=>{
    state.status=code===0&&fs.existsSync(output)?"ready":"failed";
    state.exitCode=code;state.finishedAt=new Date().toISOString();
  });
}
app.get("/health",(req,res)=>res.json({ok:true,engine:"remotion",publication:false,status:state.status,ready:state.status==="ready"}));
app.get("/status",(req,res)=>res.json({...state,id,publication:false,watchUrl:state.status==="ready"?"/watch":null,logs:state.logs.slice(-20)}));
app.get("/media",(req,res)=>{if(state.status!=="ready"||!fs.existsSync(output))return res.sendStatus(404);res.type("video/mp4").sendFile(output);});
app.get("/watch",(req,res)=>res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#090b0f;color:#f4f1e9;font-family:system-ui;padding:16px}main{max-width:560px;margin:auto}video{width:100%;max-height:90vh;background:#000;border-radius:14px}small{color:#8fa0b2}</style><main><h2>Content Control Review</h2>${state.status==="ready"?'<video controls playsinline preload="metadata" src="/media"></video>':"<p>Render status: "+state.status+"</p><script>setTimeout(()=>location.reload(),5000)</script>"}<p><small>Publication disabled</small></p></main>`));
app.listen(PORT,()=>{console.log("low-memory review worker listening",PORT);setTimeout(render,1000);});
