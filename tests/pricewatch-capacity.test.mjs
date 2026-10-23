import express from 'express';
import {createMonitorRouter} from '../monitor-api.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createStore,createWatch} from '../monitor-store.js';
import {checkWatch,checkMonitorStore} from '../monitor-runtime.js';
import {deletePriceWatch} from '../pricewatch-adapter.js';
const html=price=>`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',sku:'mug',offers:{'@type':'Offer',price,priceCurrency:'USD',availability:'https://schema.org/InStock'}})}</script>`;
const snapshot=db=>JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys\nc=sqlite3.connect(sys.argv[1]);print(json.dumps({'states':c.execute('select watch,state from price_states order by watch').fetchall(),'events':c.execute('select event from price_outbox order by event_id').fetchall(),'tombstones':c.execute('select * from price_tombstones').fetchall()}))`,db],{encoding:'utf8'}));
async function fixture(t,limits={per_watch:1,database_total:1}){
 const root=await mkdtemp(path.join(tmpdir(),'pricewatch-capacity-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const store=createStore(),db=path.join(root,'price.sqlite');const add=()=>createWatch(store,{clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD'});
 let fetches=0;const options={priceDbPath:db,priceOutboxLimits:limits};
 const run=(w,n,price,extra={})=>checkWatch(store,w.id,{...options,persist:false,priceCheckId:`check-${n}`,priceCheckedAt:`2026-10-22T12:00:${String(n).padStart(2,'0')}Z`,fetchPricePage:async()=>{fetches++;return {verified:true,finalUrl:w.target_url,html:html(price)};},...extra});
 return {store,db,add,options,run,fetches:()=>fetches};
}
test('scheduler stops before fetching at capacity and retains all durable data',async t=>{
 const f=await fixture(t);const w=f.add();await f.run(w,1,'30');await f.run(w,2,'20');const before=snapshot(f.db);let calls=0,saves=0;
 await checkMonitorStore(f.store,{...f.options,priceCheckId:'scheduled-3',priceCheckedAt:'2026-10-22T12:00:03Z',saveStore:async()=>saves++,fetchPricePage:async()=>{calls++;throw Error();}});
 assert.equal(calls,0);assert.equal(saves,1);assert.equal(w.price_monitoring_status,'price_outbox_capacity_reached');assert.deepEqual(snapshot(f.db),before);
});
test('capacity released by explicit deletion rebaselines a blocked surviving watch',async t=>{
 const f=await fixture(t);const a=f.add(),b=f.add();await f.run(a,1,'30');await f.run(b,1,'30');await f.run(a,2,'20');
 assert.equal((await f.run(b,2,'20')).reason,'price_outbox_capacity_reached');const fetches=f.fetches();assert.equal(fetches,3);
 await deletePriceWatch(a.client_id,a.id,f.options);
 const recovered=await f.run(b,3,'10');assert.equal(recovered.monitoring_status,'baseline_recorded');assert.equal(recovered.candidate_queued,false);assert.equal(snapshot(f.db).events.length,0);
 assert.equal((await f.run(b,4,'5')).candidate_queued,true);assert.equal(snapshot(f.db).tombstones.length,1);
});
test('two fetched observations racing for last global slot cannot exceed capacity',async t=>{
 const f=await fixture(t);const a=f.add(),b=f.add();await f.run(a,1,'30');await f.run(b,1,'30');let started=0,release;const barrier=new Promise(r=>release=r);
 const fetchPricePage=async()=>{if(++started===2)release();await barrier;return {verified:true,finalUrl:a.target_url,html:html('20')};};
 const outcomes=await Promise.all([f.run(a,2,'20',{fetchPricePage}),f.run(b,2,'20',{fetchPricePage})]);
 assert.equal(outcomes.filter(x=>x.candidate_queued).length,1);assert.equal(outcomes.filter(x=>x.reason==='price_outbox_capacity_reached').length,1);assert.equal(snapshot(f.db).events.length,1);
});

test('real create API reports capacity and does not fetch a new price watch',async t=>{
 const f=await fixture(t);const w=f.add();await f.run(w,1,'30');await f.run(w,2,'20');const before=snapshot(f.db);let calls=0;
 const app=express();app.use('/ext',createMonitorRouter(f.store,{enablePriceWatches:true,...f.options,saveStore:async()=>{},fetchPricePage:async()=>{calls++;throw Error();}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const response=await fetch(`http://127.0.0.1:${server.address().port}/ext/watch`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD'})});
 const result=await response.json();assert.equal(response.status,200);assert.equal(result.first_check_ok,false);assert.equal(result.price_status,'price_outbox_capacity_reached');assert.equal(calls,0);assert.deepEqual(snapshot(f.db),before);
});
