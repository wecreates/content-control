// Browser transport regression, not human listening or physical Android acceptance.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,relative,isAbsolute,sep} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {completeCoverage} from '../creative-handoff.js';
const require=createRequire(resolve(process.env.BROWSER_QA_MODULES||'.','package.json'));
const {chromium}=require('playwright');
const root=resolve('comparison-ui');
const server=createServer((req,res)=>{
 const p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/^\/compare/,'')));
 const local=relative(root,p);
 if(local==='..'||local.startsWith('..'+sep)||isAbsolute(local)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html'})[extname(p)]||'text/html');res.end(readFileSync(p===root||p===root+'/'?root+'/index.html':p));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const mode=process.argv[3]?'offline':'hosted',evidencePath=`receipts/comparison-browser-${mode}.json`;
mkdirSync('receipts',{recursive:true});
writeFileSync(evidencePath,JSON.stringify({status:'BLOCKED',reason:'browser_test_not_completed',publication_enabled:false},null,2));
let browser, page;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_QA_EXECUTABLE?{executablePath:process.env.BROWSER_QA_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,acceptDownloads:true});
 page=await context.newPage();const errors=[],downloads=[];page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d));
 await page.goto(process.argv[3]?pathToFileURL(resolve(process.argv[3])).href:`http://127.0.0.1:${server.address().port}/compare`);
 for(const name of ['candidate','reference'])await page.locator('#'+name+'-file').setInputFiles(process.argv[2]);
 await page.waitForFunction(()=>['candidate','reference'].every(n=>document.querySelector('#'+n+'-status').dataset.verified==='true'&&document.querySelector('#'+n).readyState>=2));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=360),true,'Video panels must fit the actual phone width');
 await page.click('#play');
 await page.waitForFunction(()=>document.querySelector('#candidate').currentTime>0.2&&document.querySelector('#reference').currentTime>0.2);
 await page.click('#pause');
 await page.selectOption('#audio','reference');
 assert.deepEqual(await page.evaluate(()=>['candidate','reference'].map(n=>document.querySelector('#'+n).muted)),[true,false]);
 await page.fill('#observation','Transport fixture comparison only');await page.fill('#repair','No creative conclusion from this test');
 await page.click('#export');
 assert.match(await page.locator('#message').textContent(),/unfinished finding/);assert.equal(downloads.length,0,'Unfinished notes must not be silently omitted');
 await page.click('#add');
 const download=page.waitForEvent('download');await page.click('#export');const d=await download;const receipt=JSON.parse(readFileSync(await d.path(),'utf8'));
 assert.match(receipt.candidate.sha256,/^[a-f0-9]{64}$/);assert.equal(receipt.reference.sha256,receipt.candidate.sha256);
 for(const key of ['full_audio_review','full_video_review','production_approved','publication_enabled'])assert.equal(receipt[key],false);
 assert.equal(receipt.findings.length,1);
 assert.match(receipt.playback_sessions.candidate.session_id,/^[a-f0-9]{32}$/);
 assert.equal(receipt.playback_sessions.candidate.artifact_sha256,receipt.candidate.sha256);
 assert.equal(receipt.playback_sessions.reference.perception_verified,false);
 assert.deepEqual(receipt.playback_sessions.reference.unmuted_playback_intervals,[]);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // A valid MP4 free box makes a distinct local identity without changing fixture playback.
 const replacement=Buffer.concat([readFileSync(process.argv[2]),Buffer.from([0,0,0,12,102,114,101,101,0,0,0,0])]);
 const replacementHash=createHash('sha256').update(replacement).digest('hex');
 assert.notEqual(replacementHash,receipt.reference.sha256);
 await page.fill('#source-url','https://example.com/old-reference');
 await page.fill('#observation','Unfinished note about the original pair');await page.fill('#repair','Must not follow replacement media');
 let accepted=0;page.once('dialog',async dialog=>{assert.equal(dialog.type(),'confirm');accepted++;await dialog.accept();});
 await page.locator('#reference-file').setInputFiles({name:'replacement.mp4',mimeType:'video/mp4',buffer:replacement});
 await page.waitForFunction(()=>document.querySelector('#reference-status').dataset.verified==='true'&&document.querySelector('#reference').readyState>=2&&document.querySelector('#reference-status').textContent.includes('replacement.mp4'));
 assert.equal(accepted,1);
 assert.deepEqual(await page.locator('#source-url,#observation,#repair').evaluateAll(nodes=>nodes.map(n=>n.value)),['','','']);
 assert.equal(await page.locator('#findings li').count(),0);
 const afterReplacement=page.waitForEvent('download');await page.click('#export');
 const next=JSON.parse(readFileSync(await (await afterReplacement).path(),'utf8'));
 assert.equal(next.reference.sha256,replacementHash);assert.equal(next.reference.source_url,null);assert.equal(next.findings.length,0);
 // Cancelling a later selection must retain the current media and its unfinished note.
 await page.fill('#source-url','https://example.com/current-reference');await page.fill('#observation','Keep this unfinished note');
 const currentSource=await page.locator('#reference').getAttribute('src');
 let dismissed=0;page.once('dialog',async dialog=>{assert.equal(dialog.type(),'confirm');dismissed++;await dialog.dismiss();});
 await page.locator('#reference-file').setInputFiles(process.argv[2]);
 assert.equal(dismissed,1);assert.equal(await page.locator('#reference').getAttribute('src'),currentSource);
 assert.equal(await page.locator('#observation').inputValue(),'Keep this unfinished note');
 assert.equal(await page.locator('#source-url').inputValue(),'https://example.com/current-reference');
 await page.fill('#observation','');
 const afterCancel=page.waitForEvent('download');await page.click('#export');
 const cancelled=JSON.parse(readFileSync(await (await afterCancel).path(),'utf8'));
 assert.equal(cancelled.reference.sha256,replacementHash);assert.equal(cancelled.reference.source_url,'https://example.com/current-reference');
 // Full synthetic playback in each audio selection must be usable as telemetry,
 // while still never setting observation or approval flags.
 for(const audio of ['candidate','reference']){
  await page.selectOption('#audio',audio);await page.click('#restart');await page.click('#play');
  await page.waitForFunction(()=>['candidate','reference'].every(n=>document.getElementById(n).ended));
 }
 const playedDownload=page.waitForEvent('download');await page.click('#export');
 const played=JSON.parse(readFileSync(await (await playedDownload).path(),'utf8'));
 console.log(JSON.stringify({synthetic_playback_coverage:played.playback_sessions}));
 for(const role of ['candidate','reference']){
  assert.equal(completeCoverage(played.playback_sessions[role].video_playback_intervals,played[role].duration_seconds),true);
  assert.equal(completeCoverage(played.playback_sessions[role].unmuted_playback_intervals,played[role].duration_seconds),true);
  assert.equal(played.playback_sessions[role].perception_verified,false);
 }
 assert.equal(played.full_audio_review,false);assert.equal(played.full_video_review,false);
 // Worker-start failure remains a handled, non-certifying state, with local playback available.
 const failedPage=await context.newPage(),workerErrors=[];failedPage.on('pageerror',e=>workerErrors.push(e.message));
 await failedPage.addInitScript(()=>{window.Worker=class{constructor(){throw Error('Fixture worker startup failure');}};});
 await failedPage.goto(page.url());
 for(const name of ['candidate','reference'])await failedPage.locator('#'+name+'-file').setInputFiles(process.argv[2]);
 await failedPage.waitForFunction(()=>['candidate','reference'].every(n=>document.querySelector('#'+n).readyState>=2));
 assert.match(await failedPage.locator('#message').textContent(),/verification failed/);
 await failedPage.click('#export');assert.match(await failedPage.locator('#message').textContent(),/hashes/);
 await failedPage.click('#play');await failedPage.waitForFunction(()=>document.querySelector('#candidate').currentTime>0.2);
 await failedPage.click('#pause');assert.deepEqual(workerErrors,[]);await failedPage.close();
 assert.deepEqual(errors,[]);
 writeFileSync(evidencePath,JSON.stringify({status:'PASS',mode,scope:'Chromium mobile viewport, local file selection, hashing, playback advancement, audio routing flags, unfinished-note export guard, media replacement/cancellation, worker-start failure and JSON export. Fixture only; no physical Android or creative acceptance.',publication_enabled:false},null,2));
 console.log('PASS: mobile viewport comparison transport; no creative or device certification');
 }catch(error){
 mkdirSync('receipts',{recursive:true});
 writeFileSync(evidencePath,JSON.stringify({status:'BLOCKED',reason:'browser_test_failed',publication_enabled:false},null,2));
 if(page){await page.screenshot({path:`receipts/comparison-failure-${mode}.png`,fullPage:true});
 const layout=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight,scrollY,visual:visualViewport?.height},elements:['observation','repair','add','export'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,x:r.x,y:r.y,width:r.width,height:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML};})}));
 console.log(JSON.stringify(layout));writeFileSync(`receipts/comparison-failure-${mode}.json`,JSON.stringify(layout,null,2));}
 throw error;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
