import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const HOSTS = Object.freeze({
  'instagram.com':'instagram','www.instagram.com':'instagram',
  'facebook.com':'facebook','www.facebook.com':'facebook','m.facebook.com':'facebook','fb.watch':'facebook',
  'youtube.com':'youtube','www.youtube.com':'youtube','m.youtube.com':'youtube','youtu.be':'youtube',
  'tiktok.com':'tiktok','www.tiktok.com':'tiktok','vm.tiktok.com':'tiktok','vt.tiktok.com':'tiktok',
  'threads.net':'threads','www.threads.net':'threads','threads.com':'threads','www.threads.com':'threads',
  'x.com':'x','www.x.com':'x','twitter.com':'x','www.twitter.com':'x',
  'pinterest.com':'pinterest','www.pinterest.com':'pinterest','pin.it':'pinterest',
  'linkedin.com':'linkedin','www.linkedin.com':'linkedin',
  'reddit.com':'reddit','www.reddit.com':'reddit','old.reddit.com':'reddit','redd.it':'reddit'
});
export const INTAKE_POLICY = Object.freeze({network_fetch:false,publication_enabled:false,transcript_is_full_audiovisual_analysis:false,sampled_frames_are_full_audiovisual_analysis:false,token_renewal:'plan_only'});
export const CATEGORIES = Object.freeze(['Business opportunity','Content-production technique','Marketing strategy','E-commerce product','Automation improvement']);
function fail(message) { throw new Error(message); }
export function normalizeSocialUrl(raw) {
  let u; try { u=new URL(raw); } catch { fail('Invalid URL'); }
  if(u.protocol!=='https:' || u.username || u.password || u.port) fail('Only public HTTPS platform URLs without credentials or custom ports are accepted');
  const platform=HOSTS[u.hostname.toLowerCase()];
  if(!platform) fail('Unsupported platform host');
  if(/%2f|%5c|\\/i.test(u.pathname)) fail('Encoded path separators are not accepted');
  const p=u.pathname.replace(/\/+$/,''); let id, canonical;
  const match=(re)=>p.match(re);
  if(platform==='instagram') { const m=match(/^\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)$/); if(m){id=m[1];canonical=`https://www.instagram.com${p}/`;} }
  if(platform==='youtube') {
    id=u.hostname==='youtu.be'?match(/^\/([A-Za-z0-9_-]{11})$/)?.[1]:p==='/watch'?u.searchParams.get('v'):match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})$/)?.[1];
    if(id && /^[A-Za-z0-9_-]{11}$/.test(id)) canonical=`https://www.youtube.com/watch?v=${id}`;
  }
  if(platform==='x') {const m=match(/^\/[A-Za-z0-9_]+\/status\/(\d+)$/);if(m){id=m[1];canonical=`https://x.com/i/status/${id}`;}}
  if(platform==='threads') {const m=match(/^\/@[A-Za-z0-9_.]+\/post\/([A-Za-z0-9_-]+)$/);if(m){id=m[1];canonical=`https://www.threads.com${p}`;}}
  if(platform==='tiktok') {const m=match(/^\/@[A-Za-z0-9_.]+\/video\/(\d+)$/);if(m){id=m[1];canonical=`https://www.tiktok.com${p}`;}}
  if(platform==='pinterest') {const m=match(/^\/pin\/(\d+)$/);if(m){id=m[1];canonical=`https://www.pinterest.com/pin/${id}/`;}}
  if(platform==='reddit') {const m=u.hostname==='redd.it'?match(/^\/([A-Za-z0-9]+)$/):match(/^\/(?:r\/[^/]+\/)?comments\/([A-Za-z0-9]+)(?:\/.*)?$/);if(m){id=m[1].toLowerCase();canonical=`https://www.reddit.com/comments/${id}/`;}}
  if(platform==='linkedin') {const m=match(/^\/feed\/update\/(urn:li:activity:\d+)$/);const a=match(/^\/posts\/[^/]*activity-(\d+)(?:-[^/]*)?$/);if(m||a){id=m?m[1]:`urn:li:activity:${a[1]}`;canonical=`https://www.linkedin.com/feed/update/${id}/`;}}
  if(platform==='facebook') {const m=match(/^\/(?:reel|watch|[^/]+\/videos)\/(\d+)$/);id=m?.[1]||(p==='/watch'?u.searchParams.get('v'):null);if(id&&/^\d+$/.test(id))canonical=`https://www.facebook.com/reel/${id}/`;}
  // Short links retain their own identity until an authorized resolver confirms a destination.
  if(!canonical && ['fb.watch','vm.tiktok.com','vt.tiktok.com','pin.it'].includes(u.hostname) && /^\/[A-Za-z0-9_-]+$/.test(p)){id=`short-${u.hostname}-${p.slice(1)}`;canonical=`https://${u.hostname}${p}/`;}
  if(!canonical) fail('Unsupported content URL; submit a public post or video link');
  return {platform,source_url:canonical,canonical_id:`${platform}:${id}`};
}
export function addIntake(queue,raw,options={}) {
  const n=normalizeSocialUrl(raw), copy=structuredClone(queue||{version:1,queue:[]});
  if(!Array.isArray(copy.queue)) fail('Invalid existing capability queue');
  let record=copy.queue.find(r=>r.canonical_id===n.canonical_id || (()=>{try{return normalizeSocialUrl(r.source_url).canonical_id===n.canonical_id;}catch{return false;}})());
  if(record) return {queue:copy,record,created:false};
  record={id:`social-${n.canonical_id.replace(/[^a-zA-Z0-9_-]/g,'-')}`,...n,source_type:'social_link',status:'pending_authorized_retrieval',created_at:options.now||new Date().toISOString(),publication_enabled:false,coverage:{full_video:false,full_audio:false,segments:[],transcript_segments:[],sampled_frame_seconds:[]},evidence:[],findings:[],retrieval_attempts:[],analysis_status:'not_analyzed'};
  copy.queue.push(record);return {queue:copy,record,created:true};
}
export const upsertIntake=addIntake;
export function routeFinding(queue,id,finding,{allowedProjects=[]}={}) {
  const copy=structuredClone(queue), record=copy.queue.find(r=>r.id===id);
  if(!record) fail('Unknown intake record');
  if(!CATEGORIES.includes(finding.category)) fail('Invalid finding category');
  if(!finding.project || !allowedProjects.includes(finding.project)) fail('Unknown existing project target');
  if(typeof finding.summary!=='string'||!finding.summary.trim())fail('Finding summary required');
  if(!['metadata','audiovisual','transcript','sampled_frame'].includes(finding.basis))fail('Explicit evidence basis required');
  if(!Array.isArray(finding.evidence_refs)||!finding.evidence_refs.length)fail('Recorded evidence references required');
  for(const ref of finding.evidence_refs){
    const e=record.evidence?.find(e=>e.id===ref);
    if(!e || e.verified!==true)fail('Unverified or missing recorded evidence');
    if(finding.basis==='metadata') {if(e.kind!=='metadata')fail('Metadata finding must cite metadata evidence');}
    else if(finding.basis==='transcript') {
      if(e.kind!=='transcript'||!Number.isFinite(e.start_seconds)||!Number.isFinite(e.end_seconds)||e.start_seconds<0||e.end_seconds<=e.start_seconds)fail('Valid timestamped transcript evidence required');
      if(!record.coverage?.transcript_segments?.some(s=>Number.isFinite(s.start_seconds)&&Number.isFinite(s.end_seconds)&&s.start_seconds>=0&&s.start_seconds<=e.start_seconds&&s.end_seconds>=e.end_seconds))fail('Evidence timestamps outside recorded transcript coverage');
    }
    else if(finding.basis==='sampled_frame') {
      if(e.kind!=='sampled_frame'||!Number.isFinite(e.seconds)||e.seconds<0)fail('Valid sampled-frame timestamp required');
      if(!record.coverage?.sampled_frame_seconds?.includes(e.seconds))fail('Frame timestamp outside recorded sampled frames');
    }
    else {
      if(e.kind!=='audiovisual' || !Number.isFinite(e.start_seconds)||!Number.isFinite(e.end_seconds)||e.start_seconds<0||e.end_seconds<=e.start_seconds)fail('Valid timestamped audiovisual evidence required');
      const covered=record.coverage?.segments?.some(s=>s.video===true&&s.audio===true&&Number.isFinite(s.start_seconds)&&Number.isFinite(s.end_seconds)&&s.start_seconds<=e.start_seconds&&s.end_seconds>=e.end_seconds);
      if(!covered)fail('Evidence timestamps outside verified audiovisual coverage');
    }
  }
  if(finding.full_analysis===true && (finding.basis!=='audiovisual'||record.coverage?.full_video!==true||record.coverage?.full_audio!==true))fail('Complete audiovisual coverage required for full analysis');
  const routed={id:finding.id||crypto.randomUUID(),category:finding.category,project:finding.project,summary:finding.summary,basis:finding.basis,evidence_refs:[...finding.evidence_refs],full_analysis:finding.full_analysis===true,publication_enabled:false,status:'internal_review'};
  record.findings??=[];
  if(!record.findings.some(f=>f.id===routed.id)) record.findings.push(routed);
  record.publication_enabled=false;
  return {queue:copy,record,finding:routed};
}
export function denyExternalAction(action) {const error=new Error(`External action disabled: ${String(action)}`);error.code='PUBLICATION_DISABLED';throw error;}
export function connectionStatus(connection={},now=Date.now()) {
  const expiry=Date.parse(connection.expires_at||'');
  if(!connection.last_read_verified_at)return {status:'unverified',read_verified:false};
  if(connection.error_code)return {status:'error',read_verified:false,error_code:String(connection.error_code).replace(/[^A-Z0-9_]/gi,'').slice(0,80)};
  if(Number.isFinite(expiry)&&expiry<=now)return {status:'expired',read_verified:false};
  return {status:'previously_verified',read_verified:true,last_read_verified_at:connection.last_read_verified_at};
}
export function planTokenRenewal(connection={},now=Date.now()) {
  const expiry=Date.parse(connection.expires_at||'');
  if(!connection.renewal_supported)return {action:'reauthorization_required',automatic:false};
  if(!Number.isFinite(expiry))return {action:'expiry_unknown',automatic:false};
  return {action:expiry-now<=86400000?'renewal_due':'not_due',automatic:false,implementation:'plan_only',expires_at:new Date(expiry).toISOString()};
}
const writes=new Map();
export async function updateQueueFile(file,updater) {
  const absolute=path.resolve(file),previous=writes.get(absolute)||Promise.resolve();
  const task=previous.catch(()=>{}).then(async()=>{
    const queue=JSON.parse(await fs.readFile(absolute,'utf8'));
    const result=await updater(queue),next=result.queue||result;
    if(!Array.isArray(next.queue))fail('Invalid queue update');
    const temp=`${absolute}.${crypto.randomUUID()}.tmp`;
    try {await fs.writeFile(temp,JSON.stringify(next,null,2)+'\n',{mode:0o600});await fs.rename(temp,absolute);}finally{await fs.rm(temp,{force:true});}
    return result;
  });
  writes.set(absolute,task);
  try{return await task;}finally{if(writes.get(absolute)===task)writes.delete(absolute);}
}
