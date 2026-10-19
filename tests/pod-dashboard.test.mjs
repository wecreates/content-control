import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=await fs.readFile(new URL('../integrations/pod/dashboard.js',import.meta.url),'utf8');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const record=bytes=>({id:'fixture-job',state:'qa_failed',manifest:{schema_version:1,publication_enabled:false,platform:'redbubble',package_sha256:'b'.repeat(64),files:{'print.png':sha(bytes)}}});
function harness(fetcher,timers={setTimeout,clearTimeout}){
 class Element{
  constructor(){this.value='';this.textContent='';this.hidden=false;this.listeners={};this.children=[];}
  addEventListener(name,fn){this.listeners[name]=fn;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  removeAttribute(name){delete this[name];}
  set innerHTML(value){throw Error('unsafe HTML assignment');}
 }
 const nodes=new Map(),urls=[],revoked=[],requests=[],events={};
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const context=vm.createContext({document:{getElementById:get,createElement:()=>new Element()},window:{addEventListener:(k,v)=>events[k]=v},
  AbortController,TextDecoder,Uint8Array,DataView,Blob,crypto:crypto.webcrypto,
  setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,
  URL:{createObjectURL:blob=>{urls.push(blob);return 'blob:fixture-'+urls.length;},revokeObjectURL:url=>revoked.push(url)},
  fetch:async(url,options)=>{requests.push({url,options});return fetcher(url,options);}});
 vm.runInContext(source,context);get('key').value='synthetic-key-'.repeat(4);get('state').value='review_required';
 return {get,context,urls,revoked,requests,events};
}
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const activity=()=>({schema_version:1,scope:'recorded_production_activity',
 window:{start:'2026-10-15T07:00:00.000Z',end:'2026-10-16T07:00:00.000Z',hours:24},
 counts:{registered_concept_records:'120',generated_concept_records:'100',generated_jobs:'150',generated_package_hashes:'140',jobs_with_pass_event:'80',jobs_with_fail_event:'20'},
 targets:{baseline_unique_concepts_per_day:100,scale_unique_concepts_per_day:1000},capacity_verified:false,acceptance_verified:false,publication_enabled:false});
const submit=h=>h.get('form').listeners.submit({preventDefault(){}});
test('dashboard lists jobs using authenticated bounded GET routes and text nodes',async()=>{
 const h=harness(url=>response(url.endsWith('/capacity')?activity():url.includes('/metrics')?{publication_enabled:false}:{jobs:[{id:'fixture-job',platform:'<img onerror=bad>',state:'review_required',attempt:1,can_preview:true}]}));
 await h.get('form').listeners.submit({preventDefault(){}});
 assert.equal(h.requests.length,3);
 for(const r of h.requests){assert.match(r.options.headers.Authorization,/^Bearer synthetic-key-/);assert.equal(r.options.redirect,'error');assert.equal(r.options.method,undefined);}
 assert.equal(h.get('jobs').children.length,1);
 assert.match(h.get('jobs').children[0].children[0].textContent,/<img onerror=bad>/);
 assert.equal(h.get('jobs').children[0].children[2].textContent,'Open print preview');
});
test('activity separates concepts and variants with exact counts and only known aggregate fields',async()=>{
 const report=activity();report.counts.generated_jobs='9007199254740993';report.private_payload='<script>private</script>';
 const h=harness(url=>response(url.endsWith('/capacity')?report:url.includes('/metrics')?{publication_enabled:false}:{jobs:[]}));
 await submit(h);
 assert.match(h.get('activity-window').textContent,/2026-10-15T07:00:00.000Z to 2026-10-16T07:00:00.000Z/);
 const lines=h.get('activity-counts').children.map(x=>x.textContent);
 assert.equal(lines.length,6);assert.equal(lines[1],'Concept records with generation events: 100');
 assert.equal(lines[2],'Generated jobs (includes variants and revisions): 9007199254740993');
 assert.doesNotMatch(lines.join(' '),/private|script/);assert.equal(h.get('notice').textContent,'No matching jobs.');
 h.get('clear').listeners.click();assert.equal(h.get('activity-counts').children.length,0);
 assert.equal(h.get('activity-window').textContent,'Authenticate to load recorded activity.');
});
test('activity survives independent metrics or jobs failures and unavailable activity preserves useful panels',async()=>{
 for(const failed of ['/capacity','/metrics','/jobs']){
  const h=harness(url=>url.includes(failed)?new Response('private details',{status:503}):response(url.endsWith('/capacity')?activity():url.includes('/metrics')?{health:{status:'CRITICAL'}}:{jobs:[{id:'job',platform:'kdp',state:'blocked'}]}));
  await submit(h);
  assert.equal(h.get('activity-counts').children.length,failed==='/capacity'?0:6);
  assert.equal(h.get('jobs').children.length,failed==='/jobs'?0:1);
  if(failed!=='/metrics')assert.match(h.get('result').textContent,/CRITICAL/);
  if(failed==='/capacity')assert.equal(h.get('activity-window').textContent,'Recorded activity unavailable.');
  assert.equal(h.get('notice').textContent,'POD data is unavailable.');
 }
});
test('malformed or approval-claiming activity never displays partial counts',async()=>{
 const mutations=[r=>r.schema_version=2,r=>r.scope='qualified_capacity',r=>r.window.hours=25,
  r=>r.window.start='invalid',r=>r.window.end='2026-10-16T08:00:00.000Z',r=>r.window.start=null,
  r=>r.capacity_verified=true,r=>delete r.acceptance_verified,r=>r.publication_enabled=true,
  r=>r.targets.baseline_unique_concepts_per_day=1,r=>r.counts.generated_jobs=9007199254740992,
  r=>r.counts.generated_jobs='01',r=>r.counts.generated_jobs='-1',r=>r.counts.generated_jobs='<img onerror=bad>',
  r=>delete r.counts.jobs_with_fail_event];
 for(const mutate of mutations){const report=activity();mutate(report);
  const h=harness(url=>response(url.endsWith('/capacity')?report:url.includes('/metrics')?{publication_enabled:false}:{jobs:[]}));
  await submit(h);assert.equal(h.get('activity-counts').children.length,0);
  assert.equal(h.get('activity-window').textContent,'Recorded activity unavailable.');
  assert.equal(h.get('notice').textContent,'Unable to verify this preview or response.');
 }
});
test('session changes prevent delayed activity from restoring protected data',async()=>{
 for(const action of ['clear','key','pagehide']){
  let release;const pending=new Promise(resolve=>release=resolve);
  const h=harness(async url=>{if(url.endsWith('/capacity')){await pending;return response(activity());}return response(url.includes('/metrics')?{}:{jobs:[]});});
  const operation=submit(h);assert.equal(h.requests.length,3);
  if(action==='pagehide')h.events.pagehide();else h.get(action).listeners[action==='clear'?'click':'input']();
  release();await operation;
  assert.equal(h.get('activity-counts').children.length,0);assert.equal(h.requests[2].options.signal.aborted,true);
  assert.equal(h.get('activity-window').textContent,'Authenticate to load recorded activity.');
 }
});
test('health metrics remain visible when expiry blocks job inspection',async()=>{
 const h=harness(url=>url.includes('/metrics')?response({health:{status:'CRITICAL',alerts:[{code:'STORAGE_EXPIRING'}]},publication_enabled:false}):new Response('{}',{status:409}));
 await h.get('form').listeners.submit({preventDefault(){}});
 assert.match(h.get('result').textContent,/STORAGE_EXPIRING/);assert.equal(h.get('jobs').children.length,0);
 assert.equal(h.get('notice').textContent,'POD data is unavailable.');
});
test('preview verifies stored hash and clears credential and blob on page exit',async()=>{
 const h=harness(url=>url.includes('/package')?response(record(png)):new Response(png));
 await h.context.openPreview('fixture-job');
 assert.equal(h.urls.length,1);assert.equal(h.get('preview').hidden,false);
 assert.deepEqual(h.requests.map(r=>r.url),['/api/print/jobs/fixture-job/package','/api/print/artifacts/'+sha(png)]);
 assert.deepEqual(Buffer.from(await h.urls[0].arrayBuffer()),png);
 h.events.pagehide();assert.equal(h.get('key').value,'');assert.equal(h.get('preview').hidden,true);
 assert.deepEqual(h.revoked,['blob:fixture-1']);assert.equal(h.get('print-preview').src,undefined);
});
test('corrupt bytes, excessive decoded dimensions and invalid identities never render',async()=>{
 for(const kind of ['hash','dimensions','identity']){
  const bytes=Buffer.from(png);if(kind==='dimensions'){bytes.writeUInt32BE(10000,16);bytes.writeUInt32BE(10000,20);}
  const data=record(bytes);if(kind==='hash')data.manifest.files['print.png']='a'.repeat(64);if(kind==='identity')data.id='different-job';
  const h=harness(url=>url.includes('/package')?response(data):new Response(bytes));
  await h.context.openPreview('fixture-job');assert.equal(h.urls.length,0,kind);assert.equal(h.get('preview').hidden,true,kind);
  assert.match(h.get('notice').textContent,/unavailable|limit|verify/);
 }
 const h=harness(()=>{throw Error('must not request an invalid job');});
 await h.context.openPreview('../private');assert.equal(h.requests.length,0);
});
test('clearing session during fetch prevents stale bytes or errors from restoring preview',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 const h=harness(async url=>{if(url.includes('/package'))return response(record(png));await pending;return new Response(png);});
 const operation=h.context.openPreview('fixture-job');
 while(h.requests.length<2)await new Promise(resolve=>setImmediate(resolve));
 h.get('clear').listeners.click();release();await operation;
 assert.equal(h.urls.length,0);assert.equal(h.get('notice').textContent,'Session cleared.');assert.equal(h.get('key').value,'');
 assert.equal(h.requests[1].options.signal.aborted,true);
});
test('bounded response reader cancels oversized streams and redacts failures',async()=>{
 let cancelled=false;
 const h=harness(()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(262145));},cancel(){cancelled=true;}})));
 await h.context.openPreview('fixture-job');assert.equal(cancelled,true);assert.equal(h.urls.length,0);
 assert.equal(h.get('notice').textContent,'Response exceeds the preview limit.');
 const denied=harness(()=>new Response('private details',{status:401}));
 await denied.context.openPreview('fixture-job');assert.equal(denied.get('notice').textContent,'Authentication failed.');
});

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function controlledTimers(){
 const pending=new Map();let id=0;
 return {pending,setTimeout(fn,ms){pending.set(++id,{fn,ms});return id;},clearTimeout(id){pending.delete(id);},
  fire(){for(const [id,{fn,ms}] of [...pending]){assert.equal(ms,30000);pending.delete(id);fn();}}};
}
test('oversized preview rejects promptly even when stream cancellation never settles',async()=>{
 let cancelled=0;
 const h=harness(()=>new Response(new ReadableStream({
  start(c){c.enqueue(new Uint8Array(262145));},cancel(){cancelled++;return new Promise(()=>{});}
 })));
 const operation=h.context.openPreview('fixture-job');
 const settled=await Promise.race([operation.then(()=>true),new Promise(r=>setTimeout(()=>r(false),100))]);
 assert.equal(settled,true,'transport cleanup must not hold the size rejection');
 assert.equal(cancelled,1);assert.equal(h.get('notice').textContent,'Response exceeds the preview limit.');
});
test('cleanup rejection cannot replace the bounded response error',async()=>{
 const h=harness(()=>new Response(new ReadableStream({
  start(c){c.enqueue(new Uint8Array(262145));},cancel(){return Promise.reject(Error('private cleanup details'));}
 })));
 await h.context.openPreview('fixture-job');
 assert.equal(h.get('notice').textContent,'Response exceeds the preview limit.');assert.equal(h.urls.length,0);
});
for(const stage of ['fetch','body'])test('shared preview deadline bounds stalled '+stage+' without rendering',async()=>{
 const timers=controlledTimers();let cancelled=0;
 const h=harness(()=>stage==='fetch'?new Promise(()=>{}):new Response(new ReadableStream({
  pull(){return new Promise(()=>{});},cancel(){cancelled++;return new Promise(()=>{});}
 })),timers);
 const operation=h.context.openPreview('fixture-job');await flush();
 assert.equal(timers.pending.size,1);timers.fire();await operation;
 assert.equal(h.get('notice').textContent,'POD request timed out. Try again.');
 assert.equal(h.urls.length,0);assert.equal(h.requests[0].options.signal.aborted,true);
 assert.equal(timers.pending.size,0);if(stage==='body')assert.equal(cancelled,1);
});
test('timeout retains completed operations panels while bounding a stalled peer',async()=>{
 const timers=controlledTimers();
 const h=harness(url=>url.includes('/jobs')?new Promise(()=>{}):response(url.endsWith('/capacity')?activity():{health:{status:'CRITICAL'}}),timers);
 const operation=submit(h);await flush();assert.equal(timers.pending.size,1);timers.fire();await operation;
 assert.match(h.get('result').textContent,/CRITICAL/);assert.equal(h.get('activity-counts').children.length,6);
 assert.equal(h.get('notice').textContent,'POD request timed out. Try again.');assert.equal(timers.pending.size,0);
});
test('session clearing cancels deadline and late fetch cannot restore protected content',async()=>{
 const timers=controlledTimers();let release;
 const pending=new Promise(resolve=>release=resolve),h=harness(()=>pending,timers);
 const operation=h.context.openPreview('fixture-job');await flush();assert.equal(timers.pending.size,1);
 h.get('clear').listeners.click();await operation;assert.equal(timers.pending.size,0);
 release(response(record(png)));await flush();
 assert.equal(h.get('notice').textContent,'Session cleared.');assert.equal(h.get('key').value,'');assert.equal(h.urls.length,0);
});
test('completed preview removes deadline without clearing its valid blob',async()=>{
 const timers=controlledTimers(),h=harness(url=>url.includes('/package')?response(record(png)):new Response(png),timers);
 await h.context.openPreview('fixture-job');assert.equal(h.urls.length,1);assert.equal(timers.pending.size,0);
 timers.fire();assert.equal(h.get('preview').hidden,false);
});

test('cancellation during fetch admission consumes a later rejection without restoring the session',async()=>{
 const timers=controlledTimers();let h;
 h=harness(()=>{h.get('clear').listeners.click();return Promise.reject(Error('private late transport failure'));},timers);
 await h.context.openPreview('fixture-job');await flush();
 assert.equal(h.get('notice').textContent,'Session cleared.');assert.equal(h.urls.length,0);assert.equal(timers.pending.size,0);
});
