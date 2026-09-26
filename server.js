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
let activeJobId = null;
const LATEST_ID = "episode1-v8-latest";
const LATEST_OUTPUT = path.join(OUT, `${LATEST_ID}.mp4`);

function safeId(v="job"){ return String(v).replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,80) || "job"; }

function runRender({composition,jobId,entrypoint="remotion/index.jsx"}){
  if(activeJobId) return {started:false,activeJobId};
  const id=safeId(jobId || `render-${Date.now()}`);
  const output=path.join(OUT,`${id}.mp4`);
  const args=["remotion","render",entrypoint,composition,output,"--codec","h264","--crf","28","--concurrency","1",...(composition==="Episode1V8VerticalProof"?["--scale","0.75"]:[])];
  const child=spawn("npx",args,{stdio:["ignore","pipe","pipe"],env:process.env});
  const job={id,status:"rendering",output,composition,entrypoint,startedAt:new Date().toISOString(),logs:[]};
  jobs.set(id,job);
  activeJobId=id;
  const push=(buf)=>{const s=buf.toString();job.logs.push(s);if(job.logs.length>120)job.logs.shift();};
  child.stdout.on("data",push); child.stderr.on("data",push);
  child.on("close",(code)=>{
    job.status=code===0 && fs.existsSync(output) ? "ready" : "failed";
    job.exitCode=code;
    job.finishedAt=new Date().toISOString();
    activeJobId=null;
    if(job.status==="ready") job.watchUrl=`/watch/${id}`;
  });
  return {started:true,job};
}

app.get("/health",(req,res)=>{
  const latest=jobs.get(LATEST_ID);
  res.json({ok:true,engine:"remotion",publication:false,activeJobId,readyForRender:activeJobId===null,latestStatus:latest?.status|| (fs.existsSync(LATEST_OUTPUT)?"ready":"missing")});
});

app.post("/render",(req,res)=>{
  if(activeJobId) return res.status(409).json({error:"render already active",activeJobId,publication:false});
  const composition=req.body?.composition || "Episode1V5Proof";
  const jobId=safeId(req.body?.jobId || `render-${Date.now()}`);
  const entrypoint=composition==="Episode1V8VerticalProof" ? "remotion/v8-index.jsx" : "remotion/index.jsx";
  const started=runRender({composition,jobId,entrypoint});
  res.status(202).json({jobId,status:"rendering",watchUrl:`${req.protocol}://${req.get("host")}/watch/${jobId}`,publication:false});
});

app.get("/status/:id",(req,res)=>{
  const job=jobs.get(req.params.id);
  if(!job){
    if(req.params.id===LATEST_ID && fs.existsSync(LATEST_OUTPUT)) return res.json({id:LATEST_ID,status:"ready",composition:"Episode1V8VerticalProof",watchUrl:"/watch/latest",publication:false,logs:[]});
    return res.status(404).json({error:"unknown job"});
  }
  res.json({id:job.id,status:job.status,composition:job.composition,watchUrl:job.watchUrl||null,publication:false,logs:job.logs.slice(-12),startedAt:job.startedAt,finishedAt:job.finishedAt||null,exitCode:job.exitCode??null});
});

function watchPage(src,status="ready"){
  if(status!=="ready") return `<!doctype html><meta name="viewport" content="width=device-width"><style>body{background:#090b0f;color:#f4f1e9;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0}main{text-align:center}small{color:#8fa0b2}</style><main><h2>Content Control</h2><p>Review render status: ${status}</p><small>Publication disabled</small><script>setTimeout(()=>location.reload(),5000)</script></main>`;
  return `<!doctype html><meta name="viewport" content="width=device-width"><title>Content Control Review</title><style>body{background:#090b0f;color:#f4f1e9;font-family:system-ui;margin:0;padding:16px}main{max-width:560px;margin:auto}video{width:100%;max-height:90vh;background:#000;border-radius:14px}small{color:#8fa0b2}</style><main><h2>Content Control Review</h2><video controls playsinline preload="metadata" src="${src}"></video><p><small>Publication disabled</small></p></main>`;
}

app.get("/watch/latest",(req,res)=>{
  const job=jobs.get(LATEST_ID);
  const ready=fs.existsSync(LATEST_OUTPUT);
  res.type("html").send(watchPage("/media/latest",ready?"ready":job?.status||"starting"));
});

app.get("/media/latest",(req,res)=>{
  if(!fs.existsSync(LATEST_OUTPUT)) return res.sendStatus(404);
  res.sendFile(LATEST_OUTPUT);
});

app.get("/watch/:id",(req,res)=>{
  const job=jobs.get(req.params.id);
  if(!job) return res.status(404).send("Unknown render");
  res.type("html").send(watchPage(`/media/${job.id}`,job.status));
});

app.get("/media/:id",(req,res)=>{
  const job=jobs.get(req.params.id);
  if(!job || job.status!=="ready") return res.sendStatus(404);
  res.sendFile(job.output);
});

app.listen(PORT,()=>{
  console.log(`Content Control render worker listening on ${PORT}`);
  setTimeout(()=>{
    if(!fs.existsSync(LATEST_OUTPUT) && !activeJobId){
      console.log("Starting self-healing V8 review render");
      runRender({composition:"Episode1V8VerticalProof",jobId:LATEST_ID,entrypoint:"remotion/v8-index.jsx"});
    }
  },1500);
});
