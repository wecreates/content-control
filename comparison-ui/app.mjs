import {finding,receipt} from './model.mjs';
import {createHashWorker} from './worker.mjs';
import {createPlaybackTracker} from './playback.mjs';
const $=id=>document.getElementById(id), names=['candidate','reference'];
const sessions={}, media={}, urls={}, workers={}, identities={}, versions={candidate:0,reference:0};let findings=[];
const message=text=>{$('message').textContent=text;};
const hasDraft=()=>Boolean($('observation').value.trim()||$('repair').value.trim());
const render=()=>{$('findings').replaceChildren(...findings.map(f=>{const li=document.createElement('li');li.textContent=`${f.category} · candidate ${f.candidate_sec.toFixed(2)}s / reference ${f.reference_sec.toFixed(2)}s\n${f.observation}\nImprove: ${f.repair}`;return li;}));};
for(const name of names){
 $(name+'-file').onchange=()=>{
 const file=$(name+'-file').files[0];if(!file)return;
 const replacing=Boolean(urls[name]);
 const resetsReference=replacing&&name==='reference';
 if(replacing&&(findings.length||hasDraft()||(resetsReference&&$('source-url').value.trim()))&&!confirm('Replacing this video clears saved findings and unfinished notes'+(resetsReference?' and the reference link':'')+'. Export your findings first if needed.')){$(name+'-file').value='';return;}
 if(replacing){$('observation').value='';$('repair').value='';}
 if(resetsReference)$('source-url').value='';
 findings=[];render();media[name]=null;identities[name]=null;$(name+'-status').dataset.verified='false';workers[name]?.terminate();versions[name]++;const version=versions[name];
 sessions[name]=createPlaybackTracker(Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''));
 let worker;
 const verificationFailed=()=>{worker?.terminate();if(version!==versions[name])return;identities[name]=null;$(name+'-status').dataset.verified='false';if(media[name])media[name].identity_verified=false;message('File verification failed. Re-select the file or use a desktop browser. Export is blocked.');};
 try{
 worker=createHashWorker();workers[name]=worker;
 worker.onmessage=({data})=>{if(version!==versions[name])return;worker.terminate();
 if(data.error){verificationFailed();return;}
 identities[name]=data.identity;$(name+'-status').dataset.verified='true';if(media[name])Object.assign(media[name],data.identity);message('File identity verified locally. Review remains pending.');};
 worker.onerror=event=>{event.preventDefault?.();verificationFailed();};
 worker.postMessage(file);
 }catch{verificationFailed();}
 $(name).pause();if(urls[name])URL.revokeObjectURL(urls[name]);urls[name]=URL.createObjectURL(file);
 $(name+'-status').textContent='Loading…';const v=$(name);
 v.onloadedmetadata=()=>{if(version!==versions[name])return;if(!Number.isFinite(v.duration)||v.duration<=0||!v.videoWidth){media[name]=null;$(name+'-status').textContent='Unsupported video. Try an MP4 with H.264 video and AAC audio.';return;}
 media[name]={filename:file.name,byte_length:file.size,duration_seconds:v.duration,width:v.videoWidth,height:v.videoHeight,identity_verified:false,...(identities[name]||{})};
 $(name+'-status').textContent=`${file.name} · ${v.duration.toFixed(2)}s · ${v.videoWidth} × ${v.videoHeight}`;};
 v.onerror=()=>{media[name]=null;$(name+'-status').textContent='Cannot play this file. Try an MP4 with H.264 video and AAC audio.';};v.src=urls[name];v.load();};
}
for(const name of names){
 const v=$(name);
 const interrupt=()=>sessions[name]?.interrupt();
 for(const event of ['seeking','pause','waiting','stalled','emptied','error','ratechange','volumechange'])v.addEventListener(event,interrupt);
 v.addEventListener('timeupdate',()=>{
  if(!media[name]||v.currentSrc!==urls[name])return interrupt();
  sessions[name]?.sample({time:v.currentTime,duration:v.duration,wall:performance.now(),rate:v.playbackRate,
   playing:!v.paused&&!v.seeking&&v.readyState>=3,visible:document.visibilityState==='visible',
   audible:!v.muted&&v.volume>0&&$('audio').value===name});
 });
}
document.addEventListener('visibilitychange',()=>names.forEach(n=>sessions[n]?.interrupt()));
$('play').onclick=async()=>{if(!media.candidate||!media.reference)return message('Load both videos first.');const result=await Promise.allSettled(names.map(n=>$(n).play()));if(result.some(r=>r.status==='rejected')){names.forEach(n=>$(n).pause());message('Playback was blocked. Use each player’s Play button.');}else message('Playing both. Only the selected audio track is audible.');};
$('pause').onclick=()=>names.forEach(n=>$(n).pause());
$('restart').onclick=()=>names.forEach(n=>{$(n).pause();$(n).currentTime=0;});
$('audio').onchange=()=>names.forEach(n=>{$(n).muted=n!==$('audio').value;});
$('speed').onchange=()=>names.forEach(n=>{$(n).playbackRate=Number($('speed').value);});
$('add').onclick=()=>{try{const current=n=>media[n]&&{time:$(n).currentTime,duration:media[n].duration_seconds};findings.push(finding(current('candidate'),current('reference'),$('category').value,$('observation').value,$('repair').value));render();$('observation').value='';$('repair').value='';message('Finding added. Export to keep it.');}catch(e){message(e.message);}};
$('export').onclick=()=>{try{if(hasDraft())throw Error('Add the unfinished finding before exporting, or clear both note fields.');const report=receipt(media.candidate,media.reference,findings,$('source-url').value.trim());report.playback_sessions=Object.fromEntries(names.map(n=>[n,sessions[n].snapshot(media[n])]));const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='content-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Comparison exported. Creative approval remains pending.');}catch(e){message(e.message);}};
window.addEventListener('beforeunload',event=>{if(findings.length||hasDraft()){event.preventDefault();event.returnValue='';}});
