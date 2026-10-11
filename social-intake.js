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
  copy.queue.push(record);copy.updated_at=record.created_at;return {queue:copy,record,created:true};
}
export const upsertIntake=addIntake;
function assertCompleteCoverage(record) {
  const c=record.coverage;
  if(c?.full_video!==true||c?.full_audio!==true)fail('Complete audiovisual coverage required for full analysis');
  const probe=record.evidence?.find(e=>e.id===c.duration_evidence_ref);
  if(!probe||probe.kind!=='media_probe'||probe.verified!==true||!Number.isFinite(probe.duration_seconds)||probe.duration_seconds<=0)fail('Verified source media duration evidence required');
  const duration=probe.duration_seconds;
  const segments=(c.segments||[]).filter(s=>s.video===true&&s.audio===true);
  const verified=[];
  for(const segment of segments) {
    const {start_seconds:start,end_seconds:end}=segment;
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>duration)fail('Invalid full-analysis coverage segment');
    const evidence=record.evidence?.find(e=>e.id===segment.evidence_ref);
    if(!evidence||evidence.kind!=='audiovisual'||evidence.verified!==true||!Number.isFinite(evidence.start_seconds)||!Number.isFinite(evidence.end_seconds)||evidence.start_seconds<0||evidence.start_seconds>start||evidence.end_seconds<end||evidence.end_seconds>duration)fail('Full coverage segment lacks recorded audiovisual evidence');
    verified.push({start,end});
  }
  let covered=0;
  for(const s of verified.sort((a,b)=>a.start-b.start)) {
    if(s.start>covered)fail('Gap in full audiovisual coverage');
    covered=Math.max(covered,s.end);
  }
  if(covered!==duration)fail('Full audiovisual coverage does not reach verified duration');
}
export function fullAnalysisCoverage(record) {
  try {assertCompleteCoverage(record);return {verified:true,scope:'recorded_duration_and_contiguous_audiovisual_evidence'};}
  catch {return {verified:false,reason:'Complete duration-bound audiovisual evidence has not been established'};}
}
export function routeFinding(queue,id,finding,{allowedProjects=[]}={}) {
  const copy=structuredClone(queue), record=copy.queue.find(r=>r.id===id);
  if(!record) fail('Unknown intake record');
  if(!CATEGORIES.includes(finding.category)) fail('Invalid finding category');
  if(!finding.project || !allowedProjects.includes(finding.project)) fail('Unknown existing project target');
  if(typeof finding.summary!=='string'||!finding.summary.trim())fail('Finding summary required');
  if(!['metadata','audiovisual','transcript','sampled_frame'].includes(finding.basis))fail('Explicit evidence basis required');
  if(!Array.isArray(finding.evidence_refs)||!finding.evidence_refs.length)fail('Recorded evidence references required');
  const claimStatus=finding.claim_status||'observation';
  if(!['observation','creator_claim','independently_verified'].includes(claimStatus))fail('Explicit supported claim status required');
  const verificationRefs=finding.verification_refs||[];
  if(!Array.isArray(verificationRefs))fail('Invalid verification references');
  if(claimStatus==='independently_verified') {
    if(typeof finding.claim_id!=='string'||!finding.claim_id.trim()||!verificationRefs.length)fail('Claim-specific independent verification required');
    for(const ref of verificationRefs) {
      const e=record.evidence?.find(e=>e.id===ref);
      let url;try{url=new URL(e?.url);}catch{fail('Independent verification source URL required');}
      let sameSource;try{sameSource=normalizeSocialUrl(url.href).canonical_id===normalizeSocialUrl(record.source_url).canonical_id;}catch{const original=new URL(record.source_url);sameSource=url.hostname.replace(/^www\./,'')===original.hostname.replace(/^www\./,'')&&url.pathname.replace(/\/$/,'')===original.pathname.replace(/\/$/,'');}
      if(e.verified!==true||e.kind!=='metadata'||e.verification_scope!=='fact_check'||(!Array.isArray(e.supports_claim_ids)||!e.supports_claim_ids.includes(finding.claim_id))||url.protocol!=='https:'||url.username||url.password||sameSource)fail('Evidence does not independently verify this claim');
    }
  } else if(verificationRefs.length)fail('Verification references require independently_verified status');
  const evidenceIds=(record.evidence||[]).map(e=>e.id);
  if(new Set(evidenceIds).size!==evidenceIds.length)fail('Ambiguous duplicate evidence identifiers');
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
  if(finding.full_analysis===true) {if(finding.basis!=='audiovisual')fail('Complete audiovisual coverage required for full analysis');assertCompleteCoverage(record);}
  const payload={category:finding.category,project:finding.project,summary:finding.summary,basis:finding.basis,evidence_refs:[...new Set(finding.evidence_refs)].sort(),full_analysis:finding.full_analysis===true,claim_status:claimStatus,claim_id:finding.claim_id||null,verification_refs:[...new Set(verificationRefs)].sort()};
  const stableId='finding-'+crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0,24);
  const routed={id:finding.id||stableId,...payload,publication_enabled:false,status:'internal_review'};
  record.findings??=[];
  const existing=record.findings.find(f=>f.id===routed.id);
  if(existing) {
    const comparable={category:existing.category,project:existing.project,summary:existing.summary,basis:existing.basis,evidence_refs:[...new Set(existing.evidence_refs||[])].sort(),full_analysis:existing.full_analysis===true,claim_status:existing.claim_status||'observation',claim_id:existing.claim_id||null,verification_refs:[...new Set(existing.verification_refs||[])].sort()};
    if(JSON.stringify(comparable)!==JSON.stringify(payload))fail('Finding ID conflicts with persisted finding');
    if(existing.publication_enabled!==false)fail('Persisted finding publication is not disabled');
    record.publication_enabled=false;
    return {queue:copy,record,finding:existing,created:false};
  }
  record.findings.push(routed);
  record.publication_enabled=false;
  return {queue:copy,record,finding:routed,created:true};
}

export function denyExternalAction(action) {const error=new Error(`External action disabled: ${String(action)}`);error.code='PUBLICATION_DISABLED';throw error;}
export function connectionStatus(connection={},now=Date.now()) {
  if(!connection || typeof connection!=='object')return {status:'unverified',read_verified:false};
  const expiry=Date.parse(connection.expires_at||'');
  const verified=Date.parse(connection.last_read_verified_at||'');
  if(!Number.isFinite(verified)||verified>now)return {status:'unverified',read_verified:false};
  if(connection.error_code)return {status:'error',read_verified:false,error_code:String(connection.error_code).replace(/[^A-Z0-9_]/gi,'').slice(0,80)};
  if(Number.isFinite(expiry)&&expiry<=now)return {status:'expired',read_verified:false};
  if(connection.expires_at&&!Number.isFinite(expiry))return {status:'expiry_unknown',read_verified:false};
  if(now-verified>86400000)return {status:'stale',read_verified:false,last_read_verified_at:connection.last_read_verified_at};
  return {status:'previously_verified',read_verified:true,last_read_verified_at:connection.last_read_verified_at};
}
export function planTokenRenewal(connection={},now=Date.now()) {
  const expiry=Date.parse(connection.expires_at||'');
  if(connection.renewal_supported!==true)return {action:'reauthorization_required',automatic:false};
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
