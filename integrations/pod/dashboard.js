// Read-only operations UI. No approvals, mutations, persisted credentials or external URLs.
const element=id=>document.getElementById(id);
let request,previewURL=null,generation=0;
function resetView(){
 generation++;request?.abort();request=null;
 if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;
 element('print-preview').removeAttribute('src');element('preview').hidden=true;
 element('package-info').textContent='';element('preview-status').textContent='';
 element('jobs').replaceChildren();element('result').textContent='Authenticate to load metrics.';
}
function begin(){resetView();request=new AbortController();return {signal:request.signal,version:generation,key:element('key').value};}
async function read(route,context,limit){
 if(!context.key)throw Error('Enter your operations key.');
 const response=await fetch('/api/print'+route,{headers:{Authorization:'Bearer '+context.key},cache:'no-store',redirect:'error',signal:context.signal});
 if(!response.ok)throw Error(response.status===401?'Authentication failed.':'POD data is unavailable.');
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
   if(length>limit)throw Error('Response exceeds the preview limit.');chunks.push(value);}}
 finally{await reader.cancel();reader.releaseLock();}
 if(context.version!==generation)throw Error('STALE_REQUEST');
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return bytes;
}
const json=async(route,context)=>JSON.parse(new TextDecoder().decode(await read(route,context,262144)));
function failure(error,context){if(context.version===generation&&!context.signal.aborted)element('notice').textContent=error.message==='STALE_REQUEST'?'Request replaced.':
 ['Authentication failed.','Enter your operations key.','POD data is unavailable.','Response exceeds the preview limit.','Print preview is unavailable.'].includes(error.message)?error.message:'Unable to verify this preview or response.';}
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
element('form').addEventListener('submit',async event=>{
 event.preventDefault();const context=begin();element('notice').textContent='Loading…';
 try{const [metrics,jobs]=await Promise.all([json('/metrics',context),json('/jobs?state='+encodeURIComponent(element('state').value),context)]);
  if(context.version!==generation)return;listJobs(jobs.jobs);element('result').textContent=JSON.stringify(metrics,null,2);
  element('notice').textContent=jobs.jobs.length?'Select a job to inspect its print artwork.':'No matching jobs.';
 }catch(error){failure(error,context);}
});
async function openPreview(id){
 const context=begin();element('notice').textContent='Verifying print preview…';
 try{
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Print preview is unavailable.');
  const record=await json('/jobs/'+encodeURIComponent(id)+'/package',context),manifest=record.manifest;
  const hash=manifest?.files?.['print.png'];
  if(record.id!==id||manifest?.schema_version!==1||manifest.publication_enabled!==false||
   !/^[a-f0-9]{64}$/.test(hash)||!/^[a-f0-9]{64}$/.test(manifest.package_sha256))throw Error('Print preview is unavailable.');
  const bytes=await read('/artifacts/'+hash,context,16777216);
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==hash)throw Error('HASH_MISMATCH');
  // Reject non-PNG and decompression-sized previews before the browser image decoder.
  const header=[137,80,78,71,13,10,26,10],view=new DataView(bytes.buffer);
  if(bytes.length<33||!header.every((b,i)=>bytes[i]===b)||view.getUint32(8)!==13||view.getUint32(12)!==0x49484452)throw Error('PNG_INVALID');
  const width=view.getUint32(16),height=view.getUint32(20);
  if(!width||!height||width*height>25000000)throw Error('Response exceeds the preview limit.');
  if(context.version!==generation)return;
  previewURL=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));element('print-preview').src=previewURL;
  element('preview').hidden=false;element('preview-status').textContent='Verified stored print bytes · '+record.state;
  element('package-info').textContent=JSON.stringify({job_id:id,platform:manifest.platform,package_sha256:manifest.package_sha256,print_sha256:hash,size_px:[width,height]},null,2);
  element('notice').textContent='Preview loaded. This does not grant QA or publication approval.';
 }catch(error){failure(error,context);}
}
element('preview-form').addEventListener('submit',event=>{event.preventDefault();openPreview(element('job-id').value.trim());});
function clearSession(){resetView();element('key').value='';element('job-id').value='';element('notice').textContent='Session cleared.';}
element('clear').addEventListener('click',clearSession);
element('key').addEventListener('input',()=>{resetView();element('notice').textContent='Refresh to authenticate.';});
element('print-preview').addEventListener('error',()=>{resetView();element('notice').textContent='Unable to decode the print preview.';});
window.addEventListener('pagehide',clearSession);
