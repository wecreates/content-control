import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=await fs.readFile(new URL('../integrations/pod/dashboard.js',import.meta.url),'utf8');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const record=bytes=>({id:'fixture-job',state:'qa_failed',manifest:{schema_version:1,publication_enabled:false,platform:'redbubble',package_sha256:'b'.repeat(64),files:{'print.png':sha(bytes)}}});
function harness(fetcher){
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
  URL:{createObjectURL:blob=>{urls.push(blob);return 'blob:fixture-'+urls.length;},revokeObjectURL:url=>revoked.push(url)},
  fetch:async(url,options)=>{requests.push({url,options});return fetcher(url,options);}});
 vm.runInContext(source,context);get('key').value='synthetic-key-'.repeat(4);get('state').value='review_required';
 return {get,context,urls,revoked,requests,events};
}
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
test('dashboard lists jobs using authenticated bounded GET routes and text nodes',async()=>{
 const h=harness(url=>response(url.includes('/metrics')?{publication_enabled:false}:{jobs:[{id:'fixture-job',platform:'<img onerror=bad>',state:'review_required',attempt:1,can_preview:true}]}));
 await h.get('form').listeners.submit({preventDefault(){}});
 assert.equal(h.requests.length,2);
 for(const r of h.requests){assert.match(r.options.headers.Authorization,/^Bearer synthetic-key-/);assert.equal(r.options.redirect,'error');assert.equal(r.options.method,undefined);}
 assert.equal(h.get('jobs').children.length,1);
 assert.match(h.get('jobs').children[0].children[0].textContent,/<img onerror=bad>/);
 assert.equal(h.get('jobs').children[0].children[2].textContent,'Open print preview');
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
