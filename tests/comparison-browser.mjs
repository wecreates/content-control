// Browser transport regression, not human listening or physical Android acceptance.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(resolve(process.env.BROWSER_QA_MODULES,'package.json'));
const {chromium}=require('playwright');
const root=resolve('comparison-ui');
const server=createServer((req,res)=>{
 const p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/^\/compare/,'')));
 if(p!==root&&!p.startsWith(root+'/')){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html'})[extname(p)]||'text/html');res.end(readFileSync(p===root||p===root+'/'?root+'/index.html':p));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser, page;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,acceptDownloads:true});
 page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/compare`);
 for(const name of ['candidate','reference'])await page.locator('#'+name+'-file').setInputFiles(process.argv[2]);
 await page.waitForFunction(()=>['candidate','reference'].every(n=>document.querySelector('#'+n+'-status').dataset.verified==='true'&&document.querySelector('#'+n).readyState>=2));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=360),true,'Video panels must fit the actual phone width');
 await page.click('#play');
 await page.waitForFunction(()=>document.querySelector('#candidate').currentTime>0.2&&document.querySelector('#reference').currentTime>0.2);
 await page.click('#pause');
 await page.selectOption('#audio','reference');
 assert.deepEqual(await page.evaluate(()=>['candidate','reference'].map(n=>document.querySelector('#'+n).muted)),[true,false]);
 await page.fill('#observation','Transport fixture comparison only');await page.fill('#repair','No creative conclusion from this test');await page.click('#add');
 const download=page.waitForEvent('download');await page.click('#export');const d=await download;const receipt=JSON.parse(readFileSync(await d.path(),'utf8'));
 assert.match(receipt.candidate.sha256,/^[a-f0-9]{64}$/);assert.equal(receipt.reference.sha256,receipt.candidate.sha256);
 for(const key of ['full_audio_review','full_video_review','production_approved','publication_enabled'])assert.equal(receipt[key],false);
 assert.equal(receipt.findings.length,1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 mkdirSync('receipts',{recursive:true});writeFileSync('receipts/comparison-browser.json',JSON.stringify({status:'PASS',scope:'Chromium mobile viewport, local file selection, hashing, playback advancement, audio routing flags, notes and export. Fixture only; no physical Android or creative acceptance.',publication_enabled:false},null,2));
 console.log('PASS: mobile viewport comparison transport; no creative or device certification');
 }catch(error){
 mkdirSync('receipts',{recursive:true});
 if(page){await page.screenshot({path:'receipts/comparison-failure.png',fullPage:true});
 const layout=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight,scrollY,visual:visualViewport?.height},elements:['observation','repair','add','export'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,x:r.x,y:r.y,width:r.width,height:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML};})}));
 console.log(JSON.stringify(layout));writeFileSync('receipts/comparison-failure.json',JSON.stringify(layout,null,2));}
 throw error;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
