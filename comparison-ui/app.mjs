import {finding,receipt} from './model.mjs';
const $=id=>document.getElementById(id), names=['candidate','reference'];
const media={}, urls={}, versions={candidate:0,reference:0};let findings=[];
const message=text=>{$('message').textContent=text;};
const render=()=>{$('findings').replaceChildren(...findings.map(f=>{const li=document.createElement('li');li.textContent=`${f.category} · candidate ${f.candidate_sec.toFixed(2)}s / reference ${f.reference_sec.toFixed(2)}s\n${f.observation}\nImprove: ${f.repair}`;return li;}));};
for(const name of names){
 $(name+'-file').onchange=()=>{
 const file=$(name+'-file').files[0];if(!file)return;
 if(findings.length&&!confirm('Replacing this video clears the current findings. Export them first if needed.')){$(name+'-file').value='';return;}
 findings=[];render();media[name]=null;versions[name]++;const version=versions[name];
 $(name).pause();if(urls[name])URL.revokeObjectURL(urls[name]);urls[name]=URL.createObjectURL(file);
 $(name+'-status').textContent='Loading…';const v=$(name);
 v.onloadedmetadata=()=>{if(version!==versions[name])return;if(!Number.isFinite(v.duration)||v.duration<=0||!v.videoWidth){media[name]=null;$(name+'-status').textContent='Unsupported video. Try an MP4 with H.264 video and AAC audio.';return;}
 media[name]={filename:file.name,byte_length:file.size,duration_seconds:v.duration,width:v.videoWidth,height:v.videoHeight,identity_verified:false};
 $(name+'-status').textContent=`${file.name} · ${v.duration.toFixed(2)}s · ${v.videoWidth} × ${v.videoHeight}`;};
 v.onerror=()=>{media[name]=null;$(name+'-status').textContent='Cannot play this file. Try an MP4 with H.264 video and AAC audio.';};v.src=urls[name];v.load();};
}
$('play').onclick=async()=>{if(!media.candidate||!media.reference)return message('Load both videos first.');const result=await Promise.allSettled(names.map(n=>$(n).play()));if(result.some(r=>r.status==='rejected')){names.forEach(n=>$(n).pause());message('Playback was blocked. Use each player’s Play button.');}else message('Playing both. Only the selected audio track is audible.');};
$('pause').onclick=()=>names.forEach(n=>$(n).pause());
$('restart').onclick=()=>names.forEach(n=>{$(n).pause();$(n).currentTime=0;});
$('audio').onchange=()=>names.forEach(n=>{$(n).muted=n!==$('audio').value;});
$('speed').onchange=()=>names.forEach(n=>{$(n).playbackRate=Number($('speed').value);});
$('add').onclick=()=>{try{const current=n=>media[n]&&{time:$(n).currentTime,duration:media[n].duration_seconds};findings.push(finding(current('candidate'),current('reference'),$('category').value,$('observation').value,$('repair').value));render();$('observation').value='';$('repair').value='';message('Finding added. Export to keep it.');}catch(e){message(e.message);}};
$('export').onclick=()=>{try{const report=receipt(media.candidate,media.reference,findings,$('source-url').value.trim());const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='content-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Comparison exported. Creative approval remains pending.');}catch(e){message(e.message);}};
window.addEventListener('beforeunload',event=>{if(findings.length){event.preventDefault();event.returnValue='';}});
