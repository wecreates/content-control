import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {networkInterfaces} from 'node:os';
import {connect} from 'node:net';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {renderCandidate as render} from './render-candidate.mjs';
import {open} from '/app/src/shared.mjs';
import {launch,closeBrowsers} from '/app/src/host.mjs';
import {fixtureHTML,sceneTypes,cues} from './scene-fixture.mjs';
import {verifyTimeline} from './verify-output.mjs';
import {mappedFixture} from './mapped-fixture.mjs';

const mode=process.argv[2]||'success';
assert.ok(['success','missing-audio','cancel','mapped','cancel-mix','cancel-mux'].includes(mode));
const report={mode,synthetic_only:true,publication_enabled:false,production_approved:false};
const command=(exe,args)=>{
 const p=spawnSync(exe,args,{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
 assert.equal(p.status,0,`${exe}: ${p.stderr}`);
 return p.stdout;
};
const denied=host=>new Promise((resolve,reject)=>{
 const socket=connect({host,port:443});
 socket.setTimeout(2000);
 socket.on('connect',()=>{socket.destroy();reject(Error('External connection unexpectedly succeeded'));});
 socket.on('timeout',()=>{socket.destroy();reject(Error('External denial timed out instead of failing closed'));});
 socket.on('error',e=>{socket.destroy();resolve(e.code);});
});
const processes=()=>readdirSync('/proc').filter(x=>/^\d+$/.test(x)).flatMap(pid=>{
 try {
  const cmd=readFileSync(`/proc/${pid}/cmdline`,'utf8').replaceAll('\0',' ');
  const state=readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1][0];
  return state!=='Z'&&(/\/usr\/lib\/chromium\/chromium|^ffmpeg /.test(cmd))?[{pid,cmd}]:[];
 }catch{return [];}
});
const listening=()=>process._getActiveHandles().filter(h=>h.constructor.name==='Server'&&h.listening);
let opened;
try {
 assert.deepEqual(Object.keys(networkInterfaces()),['lo']);
 report.interfaces=Object.keys(networkInterfaces());
 report.external_ipv4_error=await denied('1.1.1.1');
 report.external_ipv6_error=await denied('2606:4700:4700::1111');
 assert.equal(report.external_ipv4_error,'ENETUNREACH');
 assert.equal(report.external_ipv6_error,'ENETUNREACH');
 assert.ok(!readFileSync('/proc/net/route','utf8').trim().split('\n').slice(1).length);
 report.no_external_route=true;
 report.node=process.version;
 report.chromium=command('chromium',['--version']).trim();
 report.ffmpeg=command('ffmpeg',['-version']).split('\n')[0];
 report.playwright=JSON.parse(readFileSync('/app/node_modules/playwright-core/package.json')).version;
 assert.equal(report.playwright,'1.61.1');
 // The browser has a separate negative probe, not dependent on the page's CSP.
 const netBrowser=await launch();
 try {
  const page=await netBrowser.newPage();
  report.browser_external_result=await page.evaluate(async()=>{
   try{await fetch('http://1.1.1.1/',{signal:AbortSignal.timeout(2000)});return 'unexpected_success';}
   catch(e){return e.name;}
  });
  assert.equal(report.browser_external_result,'TypeError');
 }finally{await netBrowser.close();}
 mkdirSync('/tmp/fixture',{recursive:true});mkdirSync('/tmp/home',{recursive:true});

 const output='/out/'+mode+'.mp4';
 assert.equal(existsSync(output),false,'Use a fresh output directory for each acceptance run');
 // Generate a local tone with no media imports. Source trim is exercised by every cue.
 command('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=880:sample_rate=48000:duration=0.5',
  '-c:a','pcm_s16le','/tmp/fixture/tone.wav']);
 if(mode==='mapped'){
  const snapshots={};
  for(let i=0;i<4;i++){
   const name='clip-'+i+'.wav';
   command('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=880:sample_rate=44100:duration=0.25',
    '-af',i===1?'volume=0.5':'volume=1','-ac','2','-c:a','pcm_s16le','/tmp/fixture/'+name]);
   snapshots[name]=readFileSync('/tmp/fixture/'+name);
  }
  const mapped=mappedFixture(snapshots);
  for(const [name,bytes] of Object.entries(mapped.assets))writeFileSync('/tmp/fixture/'+name,bytes);
  writeFileSync('/tmp/fixture/index.html',mapped.html);report.mapping_receipt=mapped.receipt;
 }else writeFileSync('/tmp/fixture/index.html',fixtureHTML({missingAudio:mode==='missing-audio'}));
 opened=await open('/tmp/fixture/index.html');
 assert.equal(opened.film.meta.sounds.length,4);
 report.selected_synthetic_scene_types=sceneTypes;
 report.approval_basis='original synthetic test scope only; not creative or release approval';
 report.native_scene_checks=[];
 const capture=async t=>{
  await opened.film.page.evaluate(t=>window.film.frame(t),t);
  return createHash('sha256').update(await opened.film.page.screenshot()).digest('hex');
 };
 if(mode==='mapped'){
  for(let i=0;i<4;i++){
   const a=await capture(i+.3),b=await capture(i+.8),again=await capture(i+.3);
   assert.equal(a,again);assert.notEqual(a,b);
   assert.equal(await opened.film.page.locator('#title').textContent(),'Original '+i);
  }
  await capture(1.1);assert.equal(await opened.film.page.locator('#title').textContent(),'');
  report.mapped_scene_seek_and_gap_checks=true;
 }else for(let i=0;i<4;i++){
  const a=await capture(i+.1),b=await capture(i+.7),again=await capture(i+.1);
  assert.equal(a,again);assert.notEqual(a,b);
  const visible=await opened.film.page.evaluate(()=>Array.from(document.querySelectorAll('section'))
   .filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id));
  assert.deepEqual(visible,[sceneTypes[i]]);
  report.native_scene_checks.push({type:sceneTypes[i],repeatable:true,changes:true});
 }
 await opened.close();opened=null;
 const controller=new AbortController();
 let completed=0,expectedError=null;
 try{
  await render(['/tmp/fixture/index.html'],{out:output,fps:24,workers:2,hardware:false,
   seekable:false,silent:false,samples:1,signal:controller.signal,
   onProcessStarted:({stage,proc})=>{
    if(mode==='cancel-'+stage){
     report.cancelled_stage=stage;
     proc.once('spawn',()=>{report.cancelled_child_spawned=true;controller.abort();});
    }
   },
   format:{video:['-c:v','libx264','-preset','medium','-crf','16','-threads','2','-filter_threads','1',
    '-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv']},
   onProgress:n=>{completed=n;if(mode==='cancel'&&n>=4)controller.abort();}});
 }catch(e){expectedError=e.message;}
 report.frames_completed=completed;
 if(mode.startsWith('cancel')){
  assert.match(expectedError,/cancelled/);assert.equal(existsSync(output),false);
  report.expected_failure=expectedError;report.partial_output_absent=true;
  if(mode!=='cancel'){assert.equal(completed,96);assert.equal(report.cancelled_child_spawned,true);}
  assert.deepEqual(readdirSync('/out').filter(x=>x.startsWith('.audio-candidate-')),[]);
  report.temporary_artifacts_absent=true;
 }else if(mode==='missing-audio'){
  assert.match(expectedError,/Required audio stream missing or invalid/);
  assert.equal(existsSync(output),false);
  report.missing_audio_rejected_before_render=true;
  report.frames_completed=completed;assert.equal(completed,0);
  report.partial_output_absent=true;
 }else{
  assert.equal(expectedError,null);assert.equal(completed,96);
  const info=JSON.parse(command('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',output]));
  writeFileSync('/out/'+mode+'-ffprobe.json',JSON.stringify(info,null,2));
  const video=info.streams.find(s=>s.codec_type==='video'),audio=info.streams.find(s=>s.codec_type==='audio');
  assert.equal(video.width,320);assert.equal(video.height,180);assert.equal(video.nb_read_frames,'96');
  assert.equal(video.avg_frame_rate,'24/1');assert.equal(Number(video.duration),4);
  if(mode==='missing-audio'){
   assert.equal(audio,undefined);
   assert.throws(()=>assert.ok(audio,'Required audio stream missing'),/Required audio/);
   report.upstream_silently_omits_missing_audio=true;
   report.acceptance_rejects_silent_output=true;
  }else{
   assert.ok(audio,'Required audio stream missing');assert.equal(audio.sample_rate,'48000');
   report.audio_duration_seconds=Number(audio.duration);
   report.audio_duration_matches_video=Math.abs(Number(audio.duration)-4)<=1/24;
   assert.ok(Math.abs(Number(audio.start_time)-Number(video.start_time))<=1/24);
   const raw=(args)=>{
    const r=spawnSync('ffmpeg',args,{timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(r.status,0,r.stderr?.toString());return r.stdout;
   };
   const gray=raw(['-v','error','-i',output,'-an','-vf','crop=8:8:4:4,format=gray','-f','rawvideo','-']);
   const pcm=raw(['-v','error','-i',output,'-vn','-ac','1','-ar','48000','-f','f32le','-']);
   report.av_checks=verifyTimeline(gray,pcm,cues);
   // Mutation check: a 100ms schedule mismatch must fail the acceptance oracle.
   assert.throws(()=>verifyTimeline(gray,pcm,cues.map(c=>c+.1)));
   report.shifted_schedule_rejected=true;
   report.audio_tail_gap_seconds=4-Number(audio.duration);
  }
  report.output={sha256:createHash('sha256').update(readFileSync(output)).digest('hex'),
   frames:96,duration_seconds:4,audio_present:!!audio};
 }
 report.ccsd_audio_translation_verified=mode==='mapped';
 report.full_motion_review=false;report.full_audio_review=false;
 await closeBrowsers();
 // Allow exited subprocess notifications to settle, then require clean ownership.
 await new Promise(r=>setTimeout(r,500));
 report.remaining_renderer_processes=processes();
 report.remaining_listeners=listening().length;
 assert.deepEqual(report.remaining_renderer_processes,[]);assert.equal(report.remaining_listeners,0);
 if(mode==='success'||mode==='mapped')assert.equal(report.audio_duration_matches_video,true,'Audio track must cover full video duration');
 report.passed=true;
}catch(e){report.passed=false;report.error=e.stack;process.exitCode=1;}
finally {
 await opened?.close().catch(()=>{});
 await closeBrowsers();
 writeFileSync(`/out/${mode}-report.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
