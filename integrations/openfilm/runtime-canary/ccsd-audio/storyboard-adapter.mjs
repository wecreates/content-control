// Original Content Control format adapter. No upstream imports, IO or execution.
// Produces a limited original storyboard page, never a rendering/QA approval.
const PIN='695f4a887a97258d45ffe5715eadf537b6d2579b';
const text=(value,max,label)=>{
 if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`Invalid ${label}`);
 return value;
};
const escapeHTML=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const omittedLayers=['camera','characters','environment','props','lighting','audio','fx',
 'continuity','editorial','composition','choreography','simulation','color_script','crowd',
 'longform','creative_candidates','candidate_selection','compositing','reference_mechanics'];

export function buildOpenFilmDraft(ccsd,{approvedSceneIds,originalContentConfirmed=false}={}) {
 if(ccsd?.schema_version!==1||ccsd.publication_enabled!==false||originalContentConfirmed!==true)
  throw Error('Existing CCSD, publication disabled and explicit original-content confirmation required');
 const projectId=text(ccsd.project_id,96,'project_id');
 if(!integer(ccsd.width,64,1920)||!integer(ccsd.height,64,1920)||!integer(ccsd.fps,1,60))
  throw Error('Bounded explicit CCSD dimensions and frame rate required');
 if(!Array.isArray(ccsd.scenes)||!ccsd.scenes.length||ccsd.scenes.length>100
  ||!Array.isArray(approvedSceneIds)||!approvedSceneIds.length||approvedSceneIds.length>100
  ||new Set(approvedSceneIds).size!==approvedSceneIds.length)throw Error('Invalid scene selection');
 const ids=ccsd.scenes.map(s=>text(s?.id,96,'scene id'));
 if(new Set(ids).size!==ids.length||approvedSceneIds.some(id=>!ids.includes(id)))throw Error('Unknown or duplicate scene');
 const scenes=[],omitted=[];
 let previousEnd=0;
 for(const scene of ccsd.scenes.filter(s=>approvedSceneIds.includes(s.id))){
  if(!Number.isFinite(scene.start)||!Number.isFinite(scene.end)||scene.start<previousEnd
   ||scene.end<=scene.start||scene.end>600)throw Error('Invalid or overlapping scene timeline');
  previousEnd=scene.end;
  const keys=Object.keys(scene);
  if(keys.length>32||keys.some(k=>!['id','start','end','story','text',...omittedLayers].includes(k)))
   throw Error('Unsupported scene field');
  const title=text(scene.story?.beat,200,'story beat');
  const caption=scene.text?.content??'';
  if(typeof caption!=='string'||caption.length>500)throw Error('Invalid caption');
  scenes.push({id:scene.id,start:scene.start,end:scene.end,title,caption});
  const layers=omittedLayers.filter(k=>scene[k]!=null);
  if(scene.story&&Object.keys(scene.story).some(k=>k!=='beat'))layers.push('story fields other than beat');
  if(scene.text&&Object.keys(scene.text).some(k=>k!=='content'))layers.push('text fields other than content');
  if(layers.length)omitted.push({scene_id:scene.id,layers});
 }
 const duration=scenes.at(-1).end;
 const data=JSON.stringify(scenes).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')
  .replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const html=`<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="viewport" content="width=${ccsd.width}, height=${ccsd.height}">
<title>${escapeHTML(projectId)} — original storyboard draft</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff;color:#111;font-family:Arial,sans-serif}
#card{box-sizing:border-box;padding:8%;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center}
h1{margin:.2em 0;font-size:clamp(24px,6vw,80px);overflow-wrap:anywhere}p{margin:.2em 0;font-size:clamp(18px,3vw,40px);overflow-wrap:anywhere}
svg{width:100%;height:20%;flex:0 0 20%;min-height:18px}#label{font-size:14px}
</style></head><body><div id="card"><div id="label"></div><h1 id="title"></h1><p id="caption"></p>
<svg viewBox="0 0 100 20" aria-label="original animated marker"><circle id="marker" cx="10" cy="10" r="5" fill="#6633cc"/></svg></div>
<script>
const scenes=${data};
const card=document.getElementById('card'),title=document.getElementById('title'),
 caption=document.getElementById('caption'),label=document.getElementById('label'),marker=document.getElementById('marker');
window.film={
 width:${ccsd.width},height:${ccsd.height},duration:${duration},
 frame(t){
  if(!Number.isFinite(t)||t<0||t>=${duration})throw Error('Frame time outside timeline');
  const scene=scenes.find(s=>t>=s.start&&t<s.end);
  card.style.visibility=scene?'visible':'hidden';
  title.textContent=scene?scene.title:'';
  caption.textContent=scene?scene.caption:'';
  label.textContent=scene?'STORYBOARD DRAFT · '+scene.id:'';
  const progress=scene?(t-scene.start)/(scene.end-scene.start):0;
  marker.setAttribute('cx',String(10+80*progress));
  card.style.transform='translateY('+String(scene?8*(1-progress):0)+'px)';
 }
};
</script></body></html>`;
 return {html,receipt:{
  schema_version:1,status:'DRAFT_CONTRACT_ONLY',backend:'openfilm_optional',upstream_revision:PIN,
  project_id:projectId,approved_scene_ids:[...approvedSceneIds],approval_basis:'caller_selection_not_qa_or_release_approval',
  mapped_fields:['scene.id','scene.start','scene.end','scene.story.beat','scene.text.content'],
  untranslated_layers:omitted,audio_rendered:false,original_vector_graphics:true,
  artifact_name:'index.html',duration_seconds:duration,width:ccsd.width,height:ccsd.height,
  requested_fps:ccsd.fps,default_engine:'remotion',runtime_enabled:false,runtime_verified:false,
  network_isolation_verified:false,paid_generation_enabled:false,production_approved:false,
  publication_enabled:false,full_video_review:false,full_audio_review:false,
 }};
}
