import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createStore,createWatch} from '../monitor-store.js';
import {createMonitorRouter} from '../monitor-api.js';
import {checkMonitorStore} from '../monitor-runtime.js';

test('failed initial create persistence leaves no active orphan for the scheduler',async t=>{
  const store=createStore();let rejectedWatch,fetches=0;
  const app=express();app.use(createMonitorRouter(store,{enablePriceWatches:true,
    saveStore:async()=>{rejectedWatch=store.watches[0];throw Error('injected initial save failure');},
    fetchPricePage:async()=>{fetches++;throw Error('unexpected fetch');}
  }));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>{server.closeAllConnections();server.close();});
  const response=await fetch(`http://127.0.0.1:${server.address().port}/watch`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD'})});
  assert.equal(response.status,400);assert.ok(rejectedWatch);
  assert.equal(store.watches.includes(rejectedWatch),false);
  await checkMonitorStore(store,{saveStore:async()=>{},fetchPricePage:async()=>{fetches++;throw Error('unexpected fetch');}});
  assert.equal(fetches,0);
});

test('initial save rollback preserves another watch added while persistence is pending',async t=>{
  const store=createStore();let other;
  const app=express();app.use(createMonitorRouter(store,{enablePriceWatches:true,saveStore:async()=>{
    other=createWatch(store,{clientId:'client-two',kind:'change',targetUrl:'https://shop.example.test/other'});
    throw Error('injected save failure');
  }}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>{server.closeAllConnections();server.close();});
  const response=await fetch(`http://127.0.0.1:${server.address().port}/watch`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD'})});
  assert.equal(response.status,400);assert.deepEqual(store.watches,[other]);
});

test('scheduler skips price creation while the initial save is pending',async t=>{
  const store=createStore();let saves=0,fetches=0,release,started;
  const waiting=new Promise(r=>started=r);
  const app=express();app.use(createMonitorRouter(store,{enablePriceWatches:true,saveStore:async()=>{
    if(++saves===1){started();await new Promise(r=>release=r);}
  }}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>{server.closeAllConnections();server.close();});
  const pending=fetch(`http://127.0.0.1:${server.address().port}/watch`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD'})});
  await waiting;
  assert.equal(store.watches[0].status,'creation_pending');
  await checkMonitorStore(store,{saveStore:async()=>{},fetchPricePage:async()=>{fetches++;throw Error('unexpected');}});
  release();assert.equal((await pending).status,200);
  assert.equal(store.watches[0].status,'active');assert.equal(fetches,0);
});
