import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkWatch} from '../monitor-runtime.js';
import {createStore,createWatch} from '../monitor-store.js';
const html=price=>`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',sku:'mug',offers:{'@type':'Offer',price,priceCurrency:'USD',availability:'https://schema.org/InStock'}})}</script>`;
const root=await mkdtemp(path.join(tmpdir(),'pricewatch-integration-'));
process.on('exit',()=>{});
const fixture=(name)=>{const store=createStore();const w=createWatch(store,{clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item'});w.price_currency='USD';return {store,w,db:path.join(root,name+'.sqlite')};};
const run=(f,n,body,extra={})=>checkWatch(f.store,f.w.id,{persist:false,priceDbPath:f.db,priceCheckId:`check-${n}`,priceCheckedAt:`2026-10-21T12:00:${String(n).padStart(2,'0')}Z`,fetchPricePage:async()=>({verified:true,finalUrl:f.w.target_url,html:body}),...extra});
const rows=f=>JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys\nc=sqlite3.connect(sys.argv[1]);print(json.dumps({'states':c.execute('select state from price_states').fetchall(),'events':c.execute('select event from price_outbox').fetchall()}))`,f.db],{encoding:'utf8'}));
test('actual runtime routes price checks through durable worker, keeps exact amount and deduplicates',async()=>{
 const f=fixture('normal'); assert.equal((await run(f,1,html('29.90'))).candidate_queued,false);
 assert.equal((await run(f,2,html('24.90'))).candidate_queued,true);
 assert.equal((await run(f,2,html('24.90'))).status,'duplicate');
 assert.equal(rows(f).events.length,1);assert.equal(JSON.parse(rows(f).events[0][0]).current_amount,'24.9');
 assert.equal(f.w.last_value,null);assert.deepEqual(f.store.events,[]);
});
test('gap and recovery cannot create a misleading drop',async()=>{
 const f=fixture('gap');await run(f,1,html('30'));
 assert.equal((await run(f,2,'challenge')).monitoring_status,'unsupported');
 assert.equal((await run(f,3,html('20'))).candidate_queued,false);assert.equal(rows(f).events.length,0);
});
test('unverified fetch degrades continuity; no unsafe legacy fallback',async()=>{
 const f=fixture('unverified');await run(f,1,html('30'));
 let legacy=0;const r=await run(f,2,html('20'),{fetchPricePage:async()=>({html:html('20'),finalUrl:f.w.target_url}),fetchImpl:async()=>{legacy++;throw Error();}});
 assert.equal(r.monitoring_status,'unsupported');assert.equal(legacy,0);
 assert.equal((await run(f,3,html('10'))).candidate_queued,false);
});
test('unconfigured price watches fail closed without fetching or hash alerts',async()=>{
 const f=fixture('disabled');let calls=0;const r=await checkWatch(f.store,f.w.id,{persist:false,fetchImpl:async()=>{calls++;}});
 assert.equal(r.reason,'price_integration_not_configured');assert.equal(calls,0);
});
test('same observation concurrent retries queue only one event',async()=>{
 const f=fixture('race');await run(f,1,html('30'));
 const results=await Promise.all([run(f,2,html('20')),run(f,2,html('20'))]);
 assert.deepEqual(results.map(x=>x.status).sort(),['duplicate','recorded']);assert.equal(rows(f).events.length,1);
});
test('scope isolation and zero price remain exact',async()=>{
 const f=fixture('scopes');await run(f,1,html('30'));f.w.client_id='client-two';
 assert.equal((await run(f,2,html('0'))).candidate_queued,false);assert.equal(rows(f).states.length,2);
 f.w.client_id='client-one';assert.equal((await run(f,3,html('0'))).candidate_queued,true);
 assert.equal(JSON.parse(rows(f).events[0][0]).current_amount,'0');
});
test('policy change and stale observations cannot mutate saved state',async()=>{
 const f=fixture('policy');await run(f,2,html('30'));const before=rows(f);
 assert.equal((await run(f,1,html('20'))).ok,false);f.w.price_currency='EUR';
 assert.equal((await run(f,3,html('20'))).ok,false);assert.deepEqual(rows(f),before);
});
test('generic watches retain existing hash path',async()=>{
 const f=fixture('generic');f.w.kind='change';let body='a';const options={persist:false,fetchImpl:async()=>({status:200,arrayBuffer:async()=>Buffer.from(body)})};
 assert.equal((await checkWatch(f.store,f.w.id,options)).ok,true);body='b';await checkWatch(f.store,f.w.id,options);assert.equal(f.store.events.length,1);
});
test('cleanup',async()=>{await rm(root,{recursive:true,force:true});});
