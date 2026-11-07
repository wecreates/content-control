import {createHash} from 'node:crypto';
import {mapCCSDAudio,voiceLocks} from './ccsd-audio.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function mappedFixture(snapshots){
 const speakers=['narrator','dave','points_monk','narrator'];
 const scenes=speakers.map((speaker,i)=>({id:'scene-'+i,start:i+.25,end:i+1,
  story:{beat:'Original '+i},audio:{dialogue:[{speaker,text:'Synthetic line '+i}]}}));
 const ccsd={schema_version:1,project_id:'synthetic-ccsd',width:320,height:180,fps:24,publication_enabled:false,scenes};
 const manifest={publication_enabled:false,provider:'kokoro',voice_assignments:{...voiceLocks},clips:scenes.map((s,i)=>({
  scene_id:s.id,speaker:speakers[i],voice_id:voiceLocks[speakers[i]],file:'clip-'+i+'.wav',duration:.25,
  text_sha256:sha(s.audio.dialogue[0].text),audio_sha256:sha(snapshots['clip-'+i+'.wav'])}))};
 const result=mapCCSDAudio(ccsd,manifest,snapshots,{syntheticOnly:true,originalContentConfirmed:true,approvedSceneIds:scenes.map(s=>s.id)});
 // Original test-only visual clock, layered onto the actual mapped storyboard.
 result.html=result.html.replace('<body>','<body><div id="clock" style="position:absolute;z-index:99;left:0;top:0;width:16px;height:16px;background:black"></div>')
  .replace('</script>',`const originalFrame=window.film.frame;window.film.frame=t=>{originalFrame(t);document.getElementById('clock').style.background=[.25,1.25,2.25,3.25].some(c=>t>=c&&t<c+.25)?'white':'black';};</script>`);
 return result;
}
