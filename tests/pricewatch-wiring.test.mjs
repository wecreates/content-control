import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createMonitorRouter} from '../monitor-api.js';
import {createStore,createWatch,serializeStore} from '../monitor-store.js';
import {checkWatch,checkMonitorStore} from '../monitor-runtime.js';
const html=price=>`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',sku:'mug',offers:{'@type':'Offer',price,priceCurrency:'USD',availability:'https://schema.org/InStock'}})}</script>`;
const rows=db=>JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys\nc=sqlite3.connect(sys.argv[1]);print(json.dumps({'states':c.execute('select scope,state from price_states').fetchall(),'events':c.execute('select event from price_outbox').fetchall()}))`,db],{encoding:'utf8'}));
async function fixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'pricewatch-wiring-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const store=createStore(),db=path.join(root,'price.sqlite');
 const w=createWatch(store,{clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD'});
 const run=(n,amount,extra={})=>checkWatch(store,w.id,{persist:false,priceDbPath:db,priceCheckId:`check-${n}`,priceCheckedAt:`2026-10-21T12:00:${String(n).padStart(2,'0')}Z`,fetchPricePage:async()=>({verified:true,finalUrl:w.target_url,html:html(amount)}),...extra});
 return {root,store,db,w,run};
}
test('real HTTP create-watch -> scheduler -> durable state/outbox and truthful API status',async t=>{
 const f=await fixture(t);f.store.watches=[];let amount='30';
 const stateFile=path.join(f.root,'watch-state.json');const saveStore=store=>writeFile(stateFile,serializeStore(store));
 const options={priceDbPath:f.db,saveStore,priceCheckId:'initial',priceCheckedAt:'2026-10-21T12:00:00Z',fetchPricePage:async url=>({verified:true,finalUrl:url,html:html(amount)})};
 const app=express();app.use('/ext',createMonitorRouter(f.store,{...options,enablePriceWatches:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}/ext`;
 const response=await fetch(base+'/watch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD',minimumDrop:'5',minimumDropPercent:'10'})});
 assert.equal(response.status,200);const created=await response.json();assert.equal(created.first_check_ok,true);assert.equal(created.price_status,'baseline_recorded');assert.equal(created.price_observation.amount,'30');
 amount='20';await checkMonitorStore(f.store,{...options,priceCheckId:'scheduled-1',priceCheckedAt:'2026-10-21T12:00:10Z'});
 assert.equal(rows(f.db).events.length,1);assert.equal(JSON.parse(rows(f.db).events[0][0]).current_amount,'20');
 const persisted=JSON.parse(await readFile(stateFile));assert.equal(persisted.watches[0].price_monitoring_status,'price_decreased');assert.equal(persisted.watches[0].price_currency,'USD');
 const list=await (await fetch(base+'/watch?clientId=client-one')).json();assert.equal(list.watches[0].price_last_observation.amount,'20');
 assert.deepEqual((await (await fetch(base+'/events?clientId=client-one')).json()).events,[]);
});
test('uncertain worker failure forces a new baseline before another alert',async t=>{
 const f=await fixture(t);await f.run(1,'30');assert.equal((await f.run(2,'20',{priceWorkerOptions:{python:'/nonexistent-price-python'}})).ok,false);
 const next=await f.run(3,'10');assert.equal(next.monitoring_status,'baseline_recorded');assert.equal(next.candidate_queued,false);assert.equal(rows(f.db).events.length,0);
 assert.equal((await f.run(4,'5')).candidate_queued,true);
});
test('missing configuration interrupts continuity without unsafe fallback',async t=>{
 const f=await fixture(t);await f.run(1,'30');assert.equal((await f.run(2,'20',{priceDbPath:undefined})).ok,false);
 assert.equal((await f.run(3,'10')).candidate_queued,false);assert.equal(rows(f.db).events.length,0);
});
test('scope mutation while fetching cannot write into a new tenant',async t=>{
 const f=await fixture(t);let resolve,started;const pending=new Promise(r=>started=r);
 const request=f.run(1,'30',{fetchPricePage:async()=>{started();return await new Promise(r=>resolve=r);}});await pending;
 f.w.client_id='client-two';resolve({verified:true,finalUrl:f.w.target_url,html:html('30')});assert.equal((await request).reason,'price_watch_changed');
 assert.equal(f.w.price_last_observation,undefined);
});
test('deletion while fetching cancels recording',async t=>{
 const f=await fixture(t);let resolve,started;const pending=new Promise(r=>started=r);
 const request=f.run(1,'30',{fetchPricePage:async()=>{started();return await new Promise(r=>resolve=r);}});await pending;
 f.store.watches=[];resolve({verified:true,finalUrl:f.w.target_url,html:html('30')});assert.equal((await request).reason,'price_watch_changed');
});
test('create validates exact threshold/currency and preserves legacy fail-closed watches',()=>{
 const store=createStore();const input={clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item'};
 assert.equal(createWatch(store,input).price_monitoring_status,'configuration_required');
 for(const options of [{priceCurrency:'ZZZ'},{priceCurrency:'USD',minimumDrop:5},{priceCurrency:'USD',minimumDropPercent:'100.1'},{priceCurrency:'USD',minimumDrop:'1e2'}])assert.throws(()=>createWatch(store,{...input,...options}));
 assert.equal(createWatch(store,{...input,priceCurrency:'USD',minimumDrop:'0',minimumDropPercent:'100.000'}).price_minimum_drop,'0');
});

test('target and policy mutations during fetch cancel old observations',async t=>{
 for(const [field,value] of [['target_url','https://shop.example.test/other'],['price_currency','EUR'],['price_minimum_drop','10']]){
  const f=await fixture(t);let resolve,started;const pending=new Promise(r=>started=r);const target=f.w.target_url;
  const request=f.run(1,'30',{fetchPricePage:async()=>{started();return await new Promise(r=>resolve=r);}});await pending;
  f.w[field]=value;resolve({verified:true,finalUrl:target,html:html('30')});assert.equal((await request).reason,'price_watch_changed');assert.equal(f.w.price_last_observation,undefined);
 }
});
test('old duplicate does not rewind latest price timestamp',async t=>{
 const f=await fixture(t);await f.run(1,'30');await f.run(2,'20');const checked=f.w.last_checked_at;
 assert.equal((await f.run(1,'30')).status,'duplicate');assert.equal(f.w.last_checked_at,checked);assert.equal(f.w.price_last_observation.amount,'20');
});
