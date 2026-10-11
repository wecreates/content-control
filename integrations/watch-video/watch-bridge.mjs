import {spawn} from 'node:child_process';
import {access, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {normalizeSocialUrl,addIntake,updateQueueFile} from '../../social-intake.js';

const DEFAULT_TIMEOUT_MS = 180000;
export function buildWatchInvocation({url,skillDir,python='python3',question='Summarize this video with timestamped visual and spoken evidence.'}) {
  const normalized=normalizeSocialUrl(url);
  if (!skillDir || typeof skillDir!=='string' || !skillDir.startsWith('/')) throw new Error('Absolute trusted skill directory required');
  if (typeof question!=='string'||question.length>2000) throw new Error('Invalid question');
  return {command:python,args:[resolve(skillDir,'scripts/watch.py'),normalized.source_url,'--question',question,'--engine','local'],normalized};
}
export async function runWatch({url,skillDir,python='python3',question,timeoutMs=DEFAULT_TIMEOUT_MS,runner=spawn}) {
  const invocation=buildWatchInvocation({url,skillDir,python,question});
  await access(invocation.args[0]);
  if (!(timeoutMs>0&&timeoutMs<=600000)) throw new Error('Invalid timeout');
  return new Promise((done,reject)=>{
    const child=runner(invocation.command,invocation.args,{shell:false,env:{...process.env,WATCH_ENGINE:'local'},stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',settled=false;
    const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):done(value);};
    const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new Error('WATCH_TIMEOUT'));},timeoutMs);
    child.stdout?.on('data',b=>{stdout+=b.toString();if(stdout.length>2_000_000){child.kill('SIGKILL');finish(new Error('WATCH_OUTPUT_TOO_LARGE'));}});
    child.stderr?.on('data',b=>{stderr+=b.toString();if(stderr.length>100_000)stderr=stderr.slice(-100_000);});
    child.on('error',e=>finish(e));
    child.on('close',code=>code===0?finish(null,{...invocation,stdout,stderr,exit_code:code,full_audiovisual_verified:false}):finish(new Error('WATCH_FAILED: '+String(code)+' '+stderr.slice(-800))));
  });
}
export async function queueWatchResult({queuePath,url,result,now=new Date().toISOString()}) {
  if(!result || typeof result.stdout!=='string') throw new Error('Watch result required');
  return updateQueueFile(queuePath,queue=>{
    const added=addIntake(queue,url,{now});
    const record=added.record;
    record.retrieval_attempts??=[];
    record.retrieval_attempts.push({date:now,route:'watch_skill_local',result:'output_collected_unreviewed'});
    record.unreviewed_watch_output={text:result.stdout.slice(0,20000),truncated:result.stdout.length>20000,review_required:true,verified:false};
    record.analysis_status='watch_output_pending_evidence_review';
    record.status='pending_human_or_agent_evidence_review';
    record.coverage??={full_video:false,full_audio:false,segments:[],transcript_segments:[],sampled_frame_seconds:[]};
    record.coverage.full_video=false;
    record.coverage.full_audio=false;
    record.publication_enabled=false;
    return {queue:added.queue,record,created:added.created};
  });
}
// Deliberately no automatic findings: a model must inspect frames/transcript and attach verified evidence.
