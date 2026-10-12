import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {creativeHandoff} from '../creative-handoff.js';
const [video,reviewPath,output]=process.argv.slice(2);
if(!video||!reviewPath||!output)throw new Error('Video, review and output paths required');
let result;
try {
 const hash=crypto.createHash('sha256').update(fs.readFileSync(video)).digest('hex');
 const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',video],{encoding:'utf8',timeout:30000});
 if(probe.status!==0)throw new Error('Media duration probe failed');
 const duration=Number(JSON.parse(probe.stdout).format.duration);
 const decode=spawnSync('ffmpeg',['-nostdin','-v','error','-xerror','-i',video,'-map','0:v:0','-map','0:a:0','-f','null','-'],{encoding:'utf8',timeout:180000});
 if(decode.status!==0||!Number.isFinite(duration)||duration<=0)throw new Error('Complete audiovisual decode required');
 const review=fs.existsSync(reviewPath)?JSON.parse(fs.readFileSync(reviewPath,'utf8')):null;
 const gate=creativeHandoff(review,hash,{candidate_sha256:hash,duration_seconds:duration,verified:true});
 result={status:gate.ready?'PASS':'BLOCKED',candidate_sha256:hash,duration_seconds:duration,publication_enabled:false,production_approved:gate.ready,reasons:gate.reasons};
} catch(error) {result={status:'BLOCKED',publication_enabled:false,production_approved:false,reasons:[error.message]};}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
process.exitCode=result.status==='PASS'?0:2;
