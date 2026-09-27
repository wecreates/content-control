import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outDir=path.resolve("review-output");
const output=path.join(outDir,"episode1-v10-final.mp4");
fs.mkdirSync(outDir,{recursive:true});

console.log("[review-build] rendering persistent Episode1 V10 proof");
const r=spawnSync("npx",[
  "remotion","render",
  "remotion/v10-index.jsx",
  "Episode1V10FinalProof",
  output,
  "--codec","h264",
  "--crf","26",
  "--concurrency","1",
  "--scale","0.5"
],{stdio:"inherit",env:process.env});

if(r.status!==0) process.exit(r.status||1);
const stat=fs.statSync(output);
if(stat.size<250000) process.exit(2);
console.log("[review-build] ready",JSON.stringify({output,size:stat.size,publication:false}));
