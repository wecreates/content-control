import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStore,createWatch,hydrateStore,serializeStore,isDurablePriceWatch} from '../monitor-store.js';
import {createMonitorRouter} from '../monitor-api.js';
import {checkWatch} from '../monitor-runtime.js';
import {deletePriceWatch} from '../pricewatch-adapter.js';

// Exact historical shape, not a new PriceWatch constructor with fields removed.
const legacy=()=>({id:'old-price',client_id:'legacy-client',kind:'price',target_url:'https://shop.example.test/item',label:'Old price',last_value:null,last_checked_at:null,last_change_at:null,last_status:null,status:'active'});
async function fixture(t,store,options={}){
 const app=express();app.use(createMonitorRouter(store,{saveStore:async()=>{},...options}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>{server.closeAllConnections();server.close();});
 return (route,method='GET')=>fetch(`http://127.0.0.1:${server.address().port}${route}`,{method});
}

test('historical unconfigured price kind coexists with generic list/events/delete',async t=>{
 const old=legacy(),store=hydrateStore({watches:[old],events:[]});
 const generic=createWatch(store,{clientId:old.client_id,targetUrl:old.target_url});
 store.events.push({id:'old-event',watch_id:old.id,client_id:old.client_id,type:'change'},{id:'generic-event',watch_id:generic.id,client_id:old.client_id,type:'change'});
 const request=await fixture(t,store);
 let response=await request('/watch?clientId=legacy-client');assert.equal(response.status,200);assert.equal((await response.json()).watches.length,2);
 response=await request('/events?clientId=legacy-client');assert.equal(response.status,200);assert.equal((await response.json()).events.length,2);
 response=await request('/watch/old-price?clientId=legacy-client','DELETE');assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
 assert.deepEqual(store.watches,[generic]);assert.equal(old.status,'active');
 assert.equal(store.events.length,1);assert.equal(store.events[0].watch_id,generic.id);
});

test('historical price kinds retain legacy hash checks; durable watches never fall back',async()=>{
 const old=legacy(),store=createStore({watches:[old]});let fetches=0;
 const options={persist:false,fetchImpl:async()=>{fetches++;return {status:200,arrayBuffer:async()=>Buffer.from(String(fetches))};}};
 assert.equal((await checkWatch(store,old.id,options)).ok,true);
 assert.equal((await checkWatch(store,old.id,options)).ok,true);assert.equal(store.events.length,1);
 const durable=createWatch(store,{clientId:'legacy-client',kind:'price',targetUrl:old.target_url});
 assert.equal((await checkWatch(store,durable.id,options)).reason,'price_integration_not_configured');assert.equal(fetches,2);
});

test('new marker survives roundtrip and pre-marker or unknown price metadata stays durable',()=>{
 const store=createStore(),w=createWatch(store,{clientId:'legacy-client',kind:'price',targetUrl:legacy().target_url});
 assert.equal(w.price_schema,'pricewatch.monitor.v1');assert.equal(isDurablePriceWatch(hydrateStore(JSON.parse(serializeStore(store))).watches[0]),true);
 assert.equal(isDurablePriceWatch(legacy()),false);
 for(const metadata of [{price_monitoring_status:'configuration_required'},{price_currency:'USD'},{price_schema:'unknown'}, {price_schema:null}])assert.equal(isDurablePriceWatch({...legacy(),...metadata}),true);
});

test('missing DB still blocks marked and pre-marker durable list/events/delete',async t=>{
 for(const metadata of [{price_schema:'pricewatch.monitor.v1'},{price_monitoring_status:'configuration_required'}]){
  const w={...legacy(),...metadata},store=createStore({watches:[w]});const request=await fixture(t,store);
  for(const route of ['/watch','/events'])assert.equal((await request(route+'?clientId=legacy-client')).status,503);
  assert.equal((await request('/watch/old-price?clientId=legacy-client','DELETE')).status,503);
  assert.equal(store.watches.length,1);assert.equal(w.status,'deletion_pending');
 }
});

test('configured DB reconciles tombstones even for legacy-shaped restored metadata',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'pricewatch-legacy-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const priceDbPath=path.join(root,'prices.sqlite'),old=legacy();
 await deletePriceWatch(old.client_id,old.id,{priceDbPath});
 const store=createStore({watches:[old],events:[{id:'stale-event',watch_id:old.id,client_id:old.client_id,type:'change'}]});
 const request=await fixture(t,store,{priceDbPath});
 const response=await request('/watch?clientId=legacy-client');assert.equal(response.status,200);assert.deepEqual((await response.json()).watches,[]);assert.deepEqual(store.events,[]);
});
