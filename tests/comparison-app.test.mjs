// Exercise the real app's event handlers without treating media stubs as browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {finding,receipt} from '../comparison-ui/model.mjs';
import {fileIdentity} from '../comparison-ui/hash.mjs';

const source=fs.readFileSync(new URL('../comparison-ui/app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function app({workerError=false,postError=false}={}){
 const elements=new Map(),workers=[],downloads=[],objects=new Map(),events={},confirmations=[];
 let objectId=0,confirmResult=true;
 const element=id=>{
  if(elements.has(id))return elements.get(id);
  const e={id,value:'',textContent:'',dataset:{},files:[],children:[],paused:true,currentTime:0,duration:5,videoWidth:360,videoHeight:640,muted:id==='reference',playbackRate:1,
   replaceChildren(...children){this.children=children;},pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();},load(){},click(){if(this.href)downloads.push(objects.get(this.href));}};
  elements.set(id,e);return e;
 };
 element('audio').value='candidate';element('speed').value='1';element('category').value='Hook';
 class LocalURL extends URL {
  static createObjectURL(value){const key=`blob:test-${++objectId}`;objects.set(key,value);return key;}
  static revokeObjectURL(key){objects.delete(key);}
 }
 vm.runInNewContext(source,{document:{getElementById:element,createElement:tag=>element(`created-${tag}-${elements.size}`)},window:{addEventListener:(name,fn)=>events[name]=fn},confirm:message=>{confirmations.push(message);return confirmResult;},URL:LocalURL,Blob,finding,receipt,setTimeout:()=>{},createHashWorker:()=>{
  if(workerError)throw Error('Worker blocked');
  const worker={postMessage(file){if(postError)throw Error("File could not be cloned");this.file=file;},terminate(){this.terminated=true;}};workers.push(worker);return worker;
 }});
 const select=(name,filename,bytes=filename)=>{const file=new Blob([bytes],{type:'video/mp4'});file.name=filename;element(name+'-file').files=[file];element(name+'-file').onchange();return file;};
 const complete=async name=>{const worker=workers.filter(w=>w.file===element(name+'-file').files[0]).at(-1);worker.onmessage({data:{identity:await fileIdentity(worker.file)}});element(name).onloadedmetadata();};
 const pair=async()=>{for(const name of ['candidate','reference']){select(name,name+'.mp4');await complete(name);}};
 const draft=()=>{element('observation').value='Observed on the original candidate';element('repair').value='Repair the original candidate';};
 const exportJson=async()=>{element('export').onclick();return downloads.length?JSON.parse(await downloads.at(-1).text()):null;};
 return {element,workers,downloads,events,confirmations,select,complete,pair,draft,exportJson,setConfirm:value=>confirmResult=value};
}

test('real app selection, file identity, independent timestamps and export remain pending',async()=>{
 const a=app();await a.pair();a.element('candidate').currentTime=1;a.element('reference').currentTime=2;a.draft();a.element('add').onclick();
 const report=await a.exportJson();assert.equal(report.findings[0].candidate_sec,1);assert.equal(report.findings[0].reference_sec,2);
 assert.equal(report.candidate.sha256,(await fileIdentity(a.workers[0].file)).sha256);
 assert.equal(report.reference.sha256,(await fileIdentity(a.workers[1].file)).sha256);
 for(const key of ['full_video_review','full_audio_review','production_approved','publication_enabled'])assert.equal(report[key],false);
});
test('export cannot silently omit an unfinished finding',async()=>{
 const a=app();await a.pair();a.draft();assert.equal(await a.exportJson(),null);
 assert.match(a.element('message').textContent,/add.*finding|unfinished/i);
});
test('reference replacement clears the previous source link and unfinished notes after confirmation',async()=>{
 const a=app();await a.pair();a.element('source-url').value='https://example.com/original';a.draft();
 a.select('reference','replacement.mp4');await a.complete('reference');
 assert.equal(a.confirmations.length,1);assert.equal(a.element('source-url').value,'');assert.equal(a.element('observation').value,'');assert.equal(a.element('repair').value,'');
 assert.equal((await a.exportJson()).reference.source_url,null);
});
test('candidate replacement keeps the current reference link',async()=>{
 const a=app();await a.pair();a.element('source-url').value='https://example.com/reference';a.select('candidate','replacement.mp4');await a.complete('candidate');
 assert.equal((await a.exportJson()).reference.source_url,'https://example.com/reference');
});
test('declining a replacement preserves current identity, saved findings, source and draft',async()=>{
 const a=app();await a.pair();a.element('source-url').value='https://example.com/reference';a.draft();a.element('add').onclick();a.draft();
 const oldSource=a.element('reference').src,oldWorker=a.workers.at(-1);a.setConfirm(false);a.select('reference','replacement.mp4');
 assert.equal(a.element('reference').src,oldSource);assert.equal(oldWorker.terminated,true);assert.equal(a.workers.length,2);
 assert.equal(a.element('findings').children.length,1);assert.equal(a.element('source-url').value,'https://example.com/reference');assert.equal(a.element('observation').value,'Observed on the original candidate');
});
test('worker construction failure is handled, keeps playback available, and blocks export',async()=>{
 const a=app({workerError:true});assert.doesNotThrow(()=>a.select('candidate','candidate.mp4'));
 assert.match(a.element('candidate').src,/^blob:/);a.element('candidate').onloadedmetadata();
 assert.match(a.element('message').textContent,/verification|identity/i);assert.equal(await a.exportJson(),null);
});
test('outdated worker completion cannot supply the new media identity',async()=>{
 const a=app();a.select('candidate','old.mp4');const old=a.workers[0];a.select('candidate','new.mp4');
 old.onmessage({data:{identity:await fileIdentity(old.file)}});a.element('candidate').onloadedmetadata();
 a.select('reference','reference.mp4');await a.complete('reference');assert.equal(await a.exportJson(),null);
 await a.complete('candidate');assert.equal((await a.exportJson()).candidate.filename,'new.mp4');
});
test('decode failure blocks export even after file identity succeeds',async()=>{
 const a=app();await a.pair();a.element('candidate').onerror();assert.equal(await a.exportJson(),null);
});
test('closing warns about an unfinished finding before it has been added',async()=>{
 const a=app();await a.pair();a.draft();let prevented=false;const event={preventDefault(){prevented=true;}};a.events.beforeunload(event);assert.equal(prevented,true);
});

test('either unfinished note field blocks export, while whitespace alone does not',async()=>{
 for(const field of ['observation','repair']){
  const a=app();await a.pair();a.element(field).value='Unfinished text';assert.equal(await a.exportJson(),null);
  a.element(field).value='  ';assert.equal((await a.exportJson()).findings.length,0);
 }
});
test('declining replacement with only an unfinished note preserves it',async()=>{
 const a=app();await a.pair();a.draft();const old=a.element('candidate').src;a.setConfirm(false);a.select('candidate','replacement.mp4');
 assert.equal(a.confirmations.length,1);assert.equal(a.element('candidate').src,old);assert.equal(a.element('observation').value,'Observed on the original candidate');
});
test('initial reference selection retains a link entered before choosing its file',async()=>{
 const a=app();a.element('source-url').value='https://example.com/reference';await a.pair();assert.equal(a.confirmations.length,0);
 assert.equal((await a.exportJson()).reference.source_url,'https://example.com/reference');
});
test('replacing reference asks before discarding its link even with no findings',async()=>{
 const a=app();await a.pair();a.element('source-url').value='https://example.com/reference';a.select('reference','replacement.mp4');await a.complete('reference');
 assert.equal(a.confirmations.length,1);assert.equal((await a.exportJson()).reference.source_url,null);
});
test('worker post failure is handled without interrupting media loading',()=>{
 const a=app({postError:true});assert.doesNotThrow(()=>a.select('candidate','candidate.mp4'));
 assert.match(a.element('candidate').src,/^blob:/);assert.equal(a.workers[0].terminated,true);assert.match(a.element('message').textContent,/Export is blocked/);
});
test('worker message and error failures block export, and reselection recovers',async()=>{
 for(const mode of ['message','error']){
  const a=app();await a.pair();a.select('candidate','replacement.mp4');a.element('candidate').onloadedmetadata();const failed=a.workers.at(-1);
  if(mode==='message')failed.onmessage({data:{error:'Read failed'}});else {let prevented=false;failed.onerror({preventDefault(){prevented=true;}});assert.equal(prevented,true);}
  assert.equal(a.element('candidate-status').dataset.verified,'false');assert.equal(await a.exportJson(),null);
  a.select('candidate','recovered.mp4');await a.complete('candidate');assert.equal((await a.exportJson()).candidate.filename,'recovered.mp4');
 }
});
