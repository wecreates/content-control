import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {operationalAuth} from '../integrations/pod/auth.mjs';
import {createPodRouter} from '../integrations/pod/router.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';
import {validateTemplate} from '../integrations/pod/templates.mjs';
const key='a'.repeat(48);
test('authenticated parser failures return sanitized JSON before any database operation',async()=>{
 const app=express();app.set('env','development');let calls=0,escaped=0;
 const db=new Proxy({}, {get(){calls++;throw Error('database must not be touched');}});
 app.use(createPodRouter({db,env:{},authorize:operationalAuth(key)}));
 app.use((_error,_req,res,_next)=>{escaped++;res.status(599).json({error:'escaped'});});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const cases=[
   ['/jobs','application/json','{"private-marker":',{},400,'POD_REQUEST_INVALID'],
   ['/jobs','application/json','true',{},400,'POD_REQUEST_INVALID'],
   ['/jobs','application/json','x'.repeat(262145),{},413,'POD_REQUEST_TOO_LARGE'],
   ['/artifacts','image/png',Buffer.alloc(16777217),{},413,'POD_REQUEST_TOO_LARGE'],
   ['/jobs','application/json; charset=iso-8859-1','{}',{},415,'POD_REQUEST_ENCODING_UNSUPPORTED'],
   ['/jobs','application/json','{}',{'content-encoding':'unsupported-fixture'},415,'POD_REQUEST_ENCODING_UNSUPPORTED']
  ];
  for(const [path,type,body,headers,status,code] of cases){
   const r=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':type,...headers},body});
   assert.equal(r.status,status);assert.match(r.headers.get('content-type'),/^application\/json/);
   assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{error:code});
  }
  // Unauthenticated input is rejected by auth before parsing sensitive bytes.
  const denied=await fetch(base+'/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"private-marker":'});
  assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'OWNER_AUTH_REQUIRED'});
  assert.equal(calls,0);assert.equal(escaped,0);
 }finally{await new Promise(r=>server.close(r));}
});
test('authenticated uploads share the bounded deployment storage policy',async()=>{
 const env={POD_ARTIFACT_BUDGET_BYTES:'3'};let inserts=0,transactions=0;
 const db={tx:async fn=>{transactions++;return fn({query:async(sql)=>{
  if(sql.includes('sum('))return {rows:[{bytes:'0'}]};
  if(sql.startsWith('INSERT'))inserts++;
  return {rows:[]};
 }});}};
 const app=express();app.use(createPodRouter({db,env,authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const send=()=>fetch(`http://127.0.0.1:${server.address().port}/artifacts`,{method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:'1234'});
  const rejected=await send();assert.equal(rejected.status,409);assert.deepEqual(await rejected.json(),{error:'ARTIFACT_STORAGE_BLOCKED'});assert.equal(inserts,0);
  env.POD_ARTIFACT_BUDGET_BYTES='4';assert.equal((await send()).status,201);assert.equal(inserts,1);
  const before=transactions;env.POD_ARTIFACT_BUDGET_BYTES='';
  assert.equal((await send()).status,409);assert.equal(transactions,before);assert.equal(inserts,1);
 }finally{await new Promise(r=>server.close(r));}
});
test('authenticated regional-rights evidence upload accepts and preserves text/plain',async()=>{
 const inserts=[],db={tx:fn=>fn({query:async(sql,args)=>{
  if(sql.includes('sum('))return {rows:[{bytes:'0'}]};
  if(sql.startsWith('INSERT'))inserts.push(args);
  return {rows:[]};
 }})};
 const app=express();app.use(createPodRouter({db,env:{},authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const body='synthetic regional-rights evidence; not legal approval';
  const response=await fetch(`http://127.0.0.1:${server.address().port}/artifacts`,{method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'text/plain; charset=utf-8'},body});
  assert.equal(response.status,201);assert.deepEqual(await response.json(),{
   sha256:crypto.createHash('sha256').update(body).digest('hex')});
  assert.equal(inserts.length,1);assert.equal(inserts[0][2],'text/plain');
  assert.deepEqual(inserts[0][1],Buffer.from(body));
 }finally{await new Promise(r=>server.close(r));}
});
test('authenticated KDP template archive upload accepts and preserves application/zip',async()=>{
 const inserts=[],db={tx:fn=>fn({query:async(sql,args)=>{
  if(sql.includes('sum('))return {rows:[{bytes:'0'}]};
  if(sql.startsWith('INSERT'))inserts.push(args);
  return {rows:[]};
 }})};
 const app=express();app.use(createPodRouter({db,env:{},authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const body=Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]),Buffer.from('synthetic bounded KDP template archive')]);
  const response=await fetch(`http://127.0.0.1:${server.address().port}/artifacts`,{method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/zip'},body});
  assert.equal(response.status,201);assert.deepEqual(await response.json(),{
   sha256:crypto.createHash('sha256').update(body).digest('hex')});
  assert.equal(inserts.length,1);assert.equal(inserts[0][2],'application/zip');
  assert.deepEqual(inserts[0][1],body);
 }finally{await new Promise(r=>server.close(r));}
});
const sign=p=>{const payload=JSON.stringify({schema_version:1,issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+30000,...p});return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
test('unset operational key cannot be authenticated with Bearer undefined',()=>assert.equal(operationalAuth()( {headers:{authorization:'Bearer undefined'}}),false));
test('operational key requires exact bearer match',()=>{const auth=operationalAuth(key);assert.equal(auth({headers:{authorization:`Bearer ${key}`}}),true);assert.equal(auth({headers:{authorization:`Bearer ${key}x`}}),false);});
test('artifact rejects oversize before database access',async()=>{const store=new ArtifactStore({}, {maxObjectBytes:1});await assert.rejects(store.put(Buffer.from('xx'),'image/png'),/ARTIFACT_INVALID/);});
test('artifact reads detect stored byte corruption',async()=>{const db={active(){},pool:{query:async()=>({rows:[{body:Buffer.from('wrong')}]})}};await assert.rejects(new ArtifactStore(db).get('a'.repeat(64)),/ARTIFACT_UNAVAILABLE/);});
test('financial events cannot fabricate unsigned verified income',async()=>{await assert.rejects(recordFinancialEvent({}, {payload:'{}',signature:'0'.repeat(64)},key),/SIGNATURE_INVALID/);});
test('refund sign cannot inflate net recorded income',async()=>{await assert.rejects(recordFinancialEvent({},sign({audience:'content-control:pod:finance',verified:true,authority_event_id:'a',provider_event_id:'e',provider:'p',job_id:'j',amount_minor:10,kind:'refund',currency:'USD',occurred_at:new Date().toISOString(),evidence_sha256:'a'.repeat(64)}),key),/FINANCIAL_SIGN_INVALID/);});
test('templates reject unsupported platforms despite trusted signature',()=>assert.throws(()=>validateTemplate(sign({audience:'pod:template',template:{platform:'etsy'}}),key,{platform:'etsy'}),/TEMPLATE_PROVENANCE_REQUIRED/));
test('operations endpoints require auth and redact unavailable DB errors',async()=>{
 const app=express();app.use('/api/print',createPodRouter({db:undefined,authorize:operationalAuth(key),env:{}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${server.address().port}/api/print`;
 try{assert.equal((await fetch(url+'/metrics')).status,401);assert.equal((await fetch(url+'/jobs')).status,401);const response=await fetch(url+'/metrics',{headers:{Authorization:`Bearer ${key}`}});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'POD_STORAGE_UNAVAILABLE'});assert.equal((await fetch(url+'/dashboard')).status,200);}finally{await new Promise(r=>server.close(r));}
});
test('capacity endpoint authenticates and sanitizes unavailable storage',async()=>{
 const app=express();app.use(createPodRouter({db:undefined,authorize:operationalAuth(key),env:{}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const url=`http://127.0.0.1:${server.address().port}/capacity`;
  const denied=await fetch(url);assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'OWNER_AUTH_REQUIRED'});
  const blocked=await fetch(url,{headers:{Authorization:`Bearer ${key}`}});
  assert.equal(blocked.status,503);assert.deepEqual(await blocked.json(),{error:'POD_CAPACITY_UNAVAILABLE'});
  assert.equal(blocked.headers.get('cache-control'),'no-store');
 }finally{await new Promise(r=>server.close(r));}
});
test('job inspection route authenticates and forwards only its filter',async()=>{
 const calls=[],app=express();app.use(createPodRouter({authorize:operationalAuth(key),env:{},db:{listOperationsJobs:async state=>{calls.push(state);return [{id:'fixture-job',state}];}}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/jobs?state=blocked')).status,401);assert.equal(calls.length,0);
  const result=await fetch(base+'/jobs?state=blocked',{headers:{Authorization:`Bearer ${key}`}});
  assert.deepEqual(await result.json(),{jobs:[{id:'fixture-job',state:'blocked'}],limit:50,publication_enabled:false});
  assert.deepEqual(calls,['blocked']);assert.equal(result.headers.get('cache-control'),'no-store');
  assert.match(result.headers.get('content-security-policy'),/img-src blob:/);
 }finally{await new Promise(r=>server.close(r));}
});
test('template safe box uses x y width height consistently with Python QA',()=>{
 const record={audience:'pod:template',product:'shirt',country:'US',official_source_verified:true,source_url:'https://example.org/template',source_sha256:'a'.repeat(64),observed_at:new Date().toISOString(),template:{platform:'redbubble',dpi:300,size_inches:[2,2],safe_box_px:[400,400,100,100]}};
 assert.deepEqual(validateTemplate(sign(record),key,{platform:'redbubble',product:'shirt',country:'US'}).safe_box_px,[400,400,100,100]);
 record.template.safe_box_px=[400,400,300,300];
 assert.throws(()=>validateTemplate(sign(record),key,{platform:'redbubble',product:'shirt',country:'US'}),/TEMPLATE_SAFE_ZONE_INVALID/);
});
test('requested publication cannot masquerade as enabled without an adapter',async()=>{
 const app=express();app.use(createPodRouter({env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},
  status:()=>({status:'DISABLED',production_status:'BLOCKED_PRODUCTION_CONFIGURATION'})}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const r=await fetch(`http://127.0.0.1:${server.address().port}/status`);const state=await r.json();
  assert.equal(state.publication_enabled,false);assert.equal(state.publication_requested,true);
  assert.equal(state.production_status,'BLOCKED_PRODUCTION_CONFIGURATION');
 }finally{await new Promise(r=>server.close(r));}
});
