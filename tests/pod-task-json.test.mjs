import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {createStoredTaskResolvers} from '../integrations/pod/task-resolver.mjs';
import {produceOnce} from '../scripts/pod_production_worker.mjs';

const sha='a'.repeat(64),other='c'.repeat(64),image='d'.repeat(64);
const descriptor={schema_version:1,templateScope:{product:'fixture-shirt',country:'US'},
 files:{'input.png':image,'input.json':sha},source:'input.png',template:'input.json',textLayers:'input.json',
 assetRights:'input.json',reference:'input.png'};
const json=JSON.stringify(descriptor);
function fixture(body){
 body=Buffer.isBuffer(body)?body:Buffer.from(body);
 const hash=crypto.createHash('sha256').update(body).digest('hex'),reads=[];
 const resolver=createStoredTaskResolvers({}, {env:{},store:{get:async id=>{
  reads.push(id);return id===hash?{body,media_type:'application/json'}:
   {body:Buffer.from('fixture input'),media_type:id===image?'image/png':'application/json'};
 }}});
 return {hash,reads,resolve:()=>resolver.resolveTask({brief:{task_sha256:hash}}),resolver};
}
async function blocked(body){
 const f=fixture(body);
 await assert.rejects(f.resolve().then(async task=>{await task.cleanup();return task;}),/^Error: TASK_INVALID$/);
 assert.deepEqual(f.reads,[f.hash],'reject descriptor before reading any input artifact');
}

test('duplicate task roles and escaped equivalent keys fail in either order',async()=>{
 for(const pair of ['"source":"absent","source":"input.png"',
  '"source":"input.png","source":"absent"',
  '"source":"input.png","source":"input.png"',
  '"source":"absent","sour\\u0063e":"input.png"']){
  await blocked(json.replace('"source":"input.png"',pair));
 }
});
test('duplicate nested artifact identities and template scope cannot choose the last value',async()=>{
 for(const [first,last] of [[sha,other],[other,sha],[sha,sha]]){
  await blocked(json.replace('"input.json":"'+sha+'"','"input.json":"'+first+'","input.json":"'+last+'"'));
 }
 await blocked(json.replace('"country":"US"','"country":"GB","country":"US"'));
 await blocked(json.replace('"country":"US"','"country":"US","country":"GB"'));
});
test('invalid UTF-8 and a leading BOM are rejected without replacement or stripping',async()=>{
 for(const bytes of [[0xff],[0xc0,0xaf],[0xed,0xa0,0x80],[0xe2,0x82]]){
  await blocked(Buffer.concat([Buffer.from(json.slice(0,-1)+',"note":"'),Buffer.from(bytes),Buffer.from('"}') ]));
 }
 await blocked(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(json)]));
});
test('overflowing numbers and malformed JSON have a fixed task diagnostic',async()=>{
 for(const extra of ['1e400','-1e400','{"amount":1e400}','[1e400]'])await blocked(json.slice(0,-1)+',"extra":'+extra+'}');
 await blocked('{"private detail":"not for diagnostics"');
});
test('valid Unicode and escaped JSON restore exact input bytes with caller-owned cleanup',async()=>{
 const f=fixture(JSON.stringify({...descriptor,templateScope:{product:'Café 雪',country:'US'},
  note:'literal "source": and braces {} [] \\',nested:[{same:1},{same:2}],finite:1e100}).replace('Café','Caf\\u00e9'));
 const task=await f.resolve();
 try{
  assert.deepEqual(task.templateScope,{product:'Café 雪',country:'US'});
  assert.equal(await fs.readFile(task.source,'utf8'),'fixture input');
  assert.deepEqual(f.reads,[f.hash,image,sha]);
 }finally{await task.cleanup();}
 await assert.rejects(fs.stat(task.assetRoot),{code:'ENOENT'});
});
test('production records TASK_INVALID and stops before authorization or Python on ambiguous descriptors',async()=>{
 const f=fixture(json.replace('"source":"input.png"','"source":"other","source":"input.png"'));
 const key='synthetic-task-key-'.repeat(3),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',
  destination_platform:'redbubble',mode:'PRELAUNCH',task_sha256:f.hash};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,
  expires_at_ms:Date.now()+60000,job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',
  production_permission:true,publication_permission:false,revoked:false,task_sha256:f.hash});
 let reason,authorizations=0;
 const result=await produceOnce({upstreamKey:key,env:{POD_PRODUCTION_ENABLED:'true',PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'},
  db:{claimProduction:async()=>({id:'j',account_id:brief.account_id,platform:brief.platform,fencing_token:1,brief}),failProduction:async(_job,r)=>reason=r,
   assertProducible:async()=>{authorizations++;throw Error('must not authorize');},holdProduction:async()=>{},completeProduction:async()=>({pass:false})},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:f.resolver.resolveTask});
 assert.deepEqual(result,{status:'BLOCKED',job_id:'j',reason_code:'TASK_INVALID'});
 assert.equal(reason,'TASK_INVALID');assert.equal(authorizations,0);assert.deepEqual(f.reads,[f.hash]);
});
