import express from "express";
import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const app = express();
app.use(express.json({limit:"1mb"}));
const PORT = process.env.PORT || 10000;
const OUT = path.resolve("review-output");
fs.mkdirSync(OUT,{recursive:true});
const jobs = new Map();

function safeId(v="job"){ return String(v).replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,80) || "job"; }

app.get("/health",(req,res)=>res.json({ok:true,engine:"remotion",publication:false}));

app.post("/render",(req,res)=>{
  const composition = req.body?.composition || "Episode1V5Proof";
  const jobId = safeId(req.body?.jobId || `render-${Date.now()}`);
  const output = path.join(OUT, `${jobId}.mp4`);
  const args = ["remotion","render","remotion/index.jsx",composition,output,"--codec","h264","--crf","20","--concurrency","1"];
  const child = spawn("npx", args, {stdio:["ignore","pipe","pipe"], env:process.env});
  const job = {id:jobId,status:"rendering",output,composition,startedAt:new Date().toISOString(),logs:[]};
  jobs.set(jobId,job);
  const push=(buf)=>{const s=buf.toString(); job.logs.push(s); if(job.logs.length>80) job.logs.shift();};
  child.stdout.on("data",push); child.stderr.on("data",push);
  child.on("close",(code)=>{
    job.status = code===0 && fs.existsSync(output) ? "ready" : "failed";
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    if(job.status==="ready") job.watchUrl = `${req.protocol}://${req.get("host")}/watch/${jobId}`;
  });
  res.status(202).json({jobId,status:"rendering",watchUrl:`${req.protocol}://${req.get("host")}/watch/${jobId}`,publication:false});
});

app.get("/status/:id",(req,res)=>{
  const job=jobs.get(req.params.id);
  if(!job) return res.status(404).json({error:"unknown job"});
  res.json({id:job.id,status:job.status,composition:job.composition,watchUrl:job.watchUrl||null,publication:false,logs:job.logs.slice(-10)});
});

app.get("/watch/:id",(req,res)=>{
  const job=jobs.get(req.params.id);
  if(!job) return res.status(404).send("Unknown render");
  if(job.status!=="ready") return res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width"><style>body{background:#090b0f;color:#f4f1e9;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0}main{text-align:center}small{color:#8fa0b2}</style><main><h2>Content Control</h2><p>Render status: ${job.status}</p><small>Publication disabled</small><script>setTimeout(()=>location.reload(),5000)</script></main>`);
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width"><title>Content Control Watch</title><style>body{background:#090b0f;color:#f4f1e9;font-family:system-ui;margin:0;padding:20px}main{max-width:560px;margin:auto}video{width:100%;max-height:88vh;background:#000;border-radius:12px}small{color:#8fa0b2}</style><main><h2>Content Control Review</h2><video controls playsinline preload="metadata" src="/media/${job.id}"></video><p><small>Publication disabled</small></p></main>`);
});

app.get("/media/:id",(req,res)=>{
  const job=jobs.get(req.params.id);
  if(!job || job.status!=="ready") return res.sendStatus(404);
  res.sendFile(job.output);
});

app.listen(PORT,()=>console.log(`Content Control render worker listening on ${PORT}`));