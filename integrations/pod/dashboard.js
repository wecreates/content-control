// Read-only operations UI. No approvals, mutations, persisted credentials or external URLs.
const element=id=>document.getElementById(id);
let request,deadlineTimer,previewURL=null,generation=0;
const timeoutMessage='POD request timed out. Try again.';
function resetView(){
 generation++;clearTimeout(deadlineTimer);deadlineTimer=undefined;request?.abort();request=null;
 if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;
 element('print-preview').removeAttribute('src');element('preview').hidden=true;
 element('package-info').textContent='';element('preview-status').textContent='';
 element('jobs').replaceChildren();element('result').textContent='Authenticate to load metrics.';
 element('activity-counts').replaceChildren();element('activity-window').textContent='Authenticate to load recorded activity.';
}
function begin(){
 resetView();const controller=request=new AbortController();
 deadlineTimer=setTimeout(()=>controller.abort(Error(timeoutMessage)),30000);
 return {controller,signal:controller.signal,deadline:performance.now()+30000,version:generation,key:element('key').value};
}
function checkDeadline(context){if(performance.now()>=context.deadline&&!context.signal.aborted)context.controller.abort(Error(timeoutMessage));}
function end(context){if(context.version===generation){clearTimeout(deadlineTimer);deadlineTimer=undefined;}}
async function waitFor(pending,context){
 const {signal}=context;let onAbort;
 try{
  checkDeadline(context);
  const aborted=new Promise((_,reject)=>{onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();});
  const value=await Promise.race([pending,aborted]);checkDeadline(context);signal.throwIfAborted();return value;
 }finally{if(onAbort)signal.removeEventListener('abort',onAbort);}
}
function cancelBody(body){try{Promise.resolve(body?.cancel()).catch(()=>{});}catch{}}
async function read(route,context,limit){
 if(!context.key)throw Error('Enter your operations key.');
 checkDeadline(context);context.signal.throwIfAborted();
 let response,reader;
 try{
  const pending=fetch('/api/print'+route,{headers:{Authorization:'Bearer '+context.key},cache:'no-store',redirect:'error',signal:context.signal})
   .then(value=>{response=value;if(context.signal.aborted){cancelBody(response.body);context.signal.throwIfAborted();}return value;});
  response=await waitFor(pending,context);
  if(!response.ok)throw Error(response.status===401?'Authentication failed.':'POD data is unavailable.');
  reader=response.body.getReader();const chunks=[];let length=0;
  while(true){const {done,value}=await waitFor(reader.read(),context);if(done)break;length+=value.byteLength;
   if(length>limit)throw Error('Response exceeds the preview limit.');chunks.push(value);}
  if(context.version!==generation)throw Error('STALE_REQUEST');
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
 }finally{
  // Transport cleanup is best effort: it must not hold a timeout/size rejection.
  if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}try{reader.releaseLock();}catch{}}
  else if(response?.body&&!response.body.locked)cancelBody(response.body);
 }
}
// Match the signed/runtime JSON boundary: authenticated dashboard responses must
// be unambiguous before any identity or acceptance field is used.
const responseDecoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const basePackageFiles=['art-mask.png','print.png','text-mask.png'];
const kdpPackageFiles=[...basePackageFiles,'cover.pdf','interior.pdf','interior.receipt.json'].sort();
function canonical(value){
 if(typeof value==='number'&&(!Number.isFinite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value))))throw Error('Print preview is unavailable.');
 return Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
  value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
  JSON.stringify(value);
}
function exactPackageFiles(manifest,platform){
 const files=manifest?.files,expected=platform==='kdp'?kdpPackageFiles:basePackageFiles;
 return files&&typeof files==='object'&&!Array.isArray(files)&&
  JSON.stringify(Object.keys(files).sort())===JSON.stringify(expected)&&
  Object.values(files).every(hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash));
}
async function exactPackageIdentity(manifest,manifestSha256,context){
 const bytes=new TextEncoder().encode(canonical(manifest));
 const digest=Array.from(new Uint8Array(await waitFor(crypto.subtle.digest('SHA-256',bytes),context)),b=>b.toString(16).padStart(2,'0')).join('');
 return digest===manifestSha256;
}
function parseResponseJSON(text){
 const value=JSON.parse(text),stack=[];
 for(let i=0;i<text.length;){
  const ch=text[i];
  if(ch==='"'){
   const start=i++;
   while(text[i]!=='"'){if(text[i]==='\\')i++;i++;}
   i++;
   const object=stack.at(-1);
   if(object?.expectKey){
    const key=JSON.parse(text.slice(start,i));
    if(object.keys.has(key))throw new SyntaxError('DASHBOARD_JSON_DUPLICATE_KEY');
    object.keys.add(key);object.expectKey=false;
   }
  }else if(ch==='{'){stack.push({keys:new Set(),expectKey:true});i++;}
  else if(ch==='['){stack.push(null);i++;}
  else if(ch==='}'||ch===']'){stack.pop();i++;}
  else if(ch===','){const object=stack.at(-1);if(object)object.expectKey=true;i++;}
  else if(ch===':'||/\s/.test(ch)){i++;}
  else{
   const start=i++;
   while(i<text.length&&!/[\s,}\]]/.test(text[i]))i++;
   if((ch==='-'||(ch>='0'&&ch<='9'))&&!Number.isFinite(Number(text.slice(start,i))))
    throw new SyntaxError('DASHBOARD_JSON_NONFINITE');
  }
 }
 return value;
}
const json=async(route,context)=>parseResponseJSON(responseDecoder.decode(await read(route,context,262144)));
function failure(error,context){if(context.version===generation&&(!context.signal.aborted||context.signal.reason?.message===timeoutMessage))element('notice').textContent=error.message==='STALE_REQUEST'?'Request replaced.':
 [timeoutMessage,'Authentication failed.','Enter your operations key.','POD data is unavailable.','Response exceeds the preview limit.','Print preview is unavailable.'].includes(error.message)?error.message:'Unable to verify this preview or response.';}
function listJobs(rows){
 if(!Array.isArray(rows)||rows.length>50)throw Error('INVALID_JOBS');
 const items=rows.map(job=>{
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(job.id))throw Error('INVALID_JOB');
  const item=document.createElement('li'),label=document.createElement('span');
  label.textContent=[job.platform,job.state,'Attempt '+job.attempt,job.reason_code||''].filter(Boolean).join(' · ');
  const id=document.createElement('small');id.textContent=job.id;item.append(label,id);
  if(job.can_preview===true){const button=document.createElement('button');button.type='button';button.textContent='Open print preview';
   button.addEventListener('click',()=>{element('job-id').value=job.id;openPreview(job.id);});item.append(button);}
  return item;
 });
 element('jobs').replaceChildren(...items);
}
function showActivity(report){
 const fields=[['registered_concept_records','Registered concept records'],
  ['generated_concept_records','Concept records with generation events'],['generated_jobs','Generated jobs (includes variants and revisions)'],
  ['generated_package_hashes','Distinct generated package hashes'],['jobs_with_pass_event','Jobs with a QA pass event'],
  ['jobs_with_fail_event','Jobs with a QA fail event']];
 const start=new Date(report?.window?.start),end=new Date(report?.window?.end);
 if(report?.schema_version!==1||report.scope!=='recorded_production_activity'||report.window?.hours!==24||
  !Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end-start!==86400000||
  report.window.start!==start.toISOString()||report.window.end!==end.toISOString()||
  report.capacity_verified!==false||report.acceptance_verified!==false||report.publication_enabled!==false||
  report.targets?.baseline_unique_concepts_per_day!==100||report.targets?.scale_unique_concepts_per_day!==1000||
  fields.some(([field])=>typeof report.counts?.[field]!=='string'||!/^(0|[1-9][0-9]*)$/.test(report.counts[field])))throw Error('INVALID_ACTIVITY');
 // Render only known aggregate fields. Preserve exact decimal strings; never round bigint counts.
 const items=fields.map(([field,label])=>{const item=document.createElement('li');item.textContent=label+': '+report.counts[field];return item;});
 element('activity-counts').replaceChildren(...items);
 element('activity-window').textContent='Recorded 24-hour window (UTC): '+start.toISOString()+' to '+end.toISOString();
}
element('form').addEventListener('submit',async event=>{
 event.preventDefault();const context=begin();element('notice').textContent='Loading…';
 try{const [metrics,jobs,activity]=await Promise.allSettled([json('/metrics',context),json('/jobs?state='+encodeURIComponent(element('state').value),context),json('/capacity',context)]);
  if(context.version!==generation)return;
  element('result').textContent=metrics.status==='fulfilled'?JSON.stringify(metrics.value,null,2):'Metrics unavailable.';
  let activityError;
  try{if(activity.status==='rejected')throw activity.reason;showActivity(activity.value);}
  catch(error){activityError=error;element('activity-window').textContent='Recorded activity unavailable.';}
  if(jobs.status==='fulfilled')listJobs(jobs.value.jobs);
  if(metrics.status==='rejected')throw metrics.reason;if(jobs.status==='rejected')throw jobs.reason;
  if(activityError)throw activityError;
  element('notice').textContent=jobs.value.jobs.length?'Select a job to inspect its print artwork.':'No matching jobs.';
 }catch(error){failure(error,context);}finally{end(context);}
});
async function openPreview(id){
 const context=begin();element('notice').textContent='Verifying print preview…';
 try{
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Print preview is unavailable.');
  const record=await json('/jobs/'+encodeURIComponent(id)+'/package',context),manifest=record.manifest;
  const hash=manifest?.files?.['print.png'];
  if(record.id!==id||record.state!=='qa_failed'||record.reason_code!=='REVIEW_REQUIRED'||
   !['kdp','redbubble','teepublic','zazzle','spreadshirt'].includes(record.platform)||
   manifest?.platform!==record.platform||manifest.schema_version!==1||manifest.publication_enabled!==false||
   !exactPackageFiles(manifest,record.platform)||!/^[a-f0-9]{64}$/.test(hash)||
   !/^[a-f0-9]{64}$/.test(manifest.package_sha256)||!/^[a-f0-9]{64}$/.test(record.manifest_sha256)||
   !(await exactPackageIdentity(manifest,record.manifest_sha256,context)))throw Error('Print preview is unavailable.');
  const bytes=await read('/artifacts/'+hash,context,16777216);
  const actual=Array.from(new Uint8Array(await waitFor(crypto.subtle.digest('SHA-256',bytes),context)),b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==hash)throw Error('HASH_MISMATCH');
  // Reject non-PNG and decompression-sized previews before the browser image decoder.
  const header=[137,80,78,71,13,10,26,10],view=new DataView(bytes.buffer);
  if(bytes.length<33||!header.every((b,i)=>bytes[i]===b)||view.getUint32(8)!==13||view.getUint32(12)!==0x49484452)throw Error('PNG_INVALID');
  const width=view.getUint32(16),height=view.getUint32(20);
  if(!width||!height||width*height>25000000)throw Error('Response exceeds the preview limit.');
  if(context.version!==generation)return;
  checkDeadline(context);context.signal.throwIfAborted();
  previewURL=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));element('print-preview').src=previewURL;
  element('preview').hidden=false;element('preview-status').textContent='Verified stored print bytes · '+record.state;
  element('package-info').textContent=JSON.stringify({job_id:id,platform:manifest.platform,package_sha256:manifest.package_sha256,print_sha256:hash,size_px:[width,height]},null,2);
  element('notice').textContent='Preview loaded. This does not grant QA or publication approval.';
 }catch(error){failure(error,context);}finally{end(context);}
}
element('preview-form').addEventListener('submit',event=>{event.preventDefault();openPreview(element('job-id').value.trim());});
function clearSession(){resetView();element('key').value='';element('job-id').value='';element('notice').textContent='Session cleared.';}
element('clear').addEventListener('click',clearSession);
element('key').addEventListener('input',()=>{resetView();element('notice').textContent='Refresh to authenticate.';});
element('print-preview').addEventListener('error',()=>{resetView();element('notice').textContent='Unable to decode the print preview.';});
window.addEventListener('pagehide',clearSession);
