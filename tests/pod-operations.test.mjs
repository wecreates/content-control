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
 try{assert.equal((await fetch(url+'/metrics')).status,401);const response=await fetch(url+'/metrics',{headers:{Authorization:`Bearer ${key}`}});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'POD_STORAGE_UNAVAILABLE'});assert.equal((await fetch(url+'/dashboard')).status,200);}finally{await new Promise(r=>server.close(r));}
});
