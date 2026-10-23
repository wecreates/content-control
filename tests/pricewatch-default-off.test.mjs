import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createStore,createWatch} from '../monitor-store.js';
import {createMonitorRouter} from '../monitor-api.js';
import {checkWatch} from '../monitor-runtime.js';

async function fixture(t,options={}){
 const store=createStore();let saves=0;
 const app=express();app.use(createMonitorRouter(store,{saveStore:async()=>saves++,...options}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>{server.closeAllConnections();server.close();});
 return {store,saves:()=>saves,post:body=>fetch(`http://127.0.0.1:${server.address().port}/watch`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})};
}
const price={clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD'};
test('price creation is default-off and request fields cannot enable it',async t=>{
 const f=await fixture(t);
 const r=await f.post({...price,enablePriceWatches:true,priceDbPath:'/tmp/ignored',allowedHosts:['shop.example.test']});
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'price watches disabled'});
 assert.equal(f.saves(),0);assert.deepEqual(f.store.watches,[]);
});
test('generic creation is unchanged while price routes are disabled',async t=>{
 const f=await fixture(t,{fetchImpl:async()=>({status:200,arrayBuffer:async()=>Buffer.from('fixture')})});
 const r=await f.post({...price,kind:'change'});assert.equal(r.status,200);assert.equal((await r.json()).first_check_ok,true);
 assert.equal(f.store.watches.length,1);
});
test('a restored price watch cannot use the legacy fetch without trusted configuration',async()=>{
 const store=createStore();const w=createWatch(store,price);let requests=0;
 const result=await checkWatch(store,w.id,{persist:false,fetchImpl:async()=>{requests++;throw Error('must not fetch');}});
 assert.equal(result.reason,'price_integration_not_configured');assert.equal(requests,0);
});

test('coercible JSON kind cannot bypass default-off creation',async t=>{
 const f=await fixture(t);
 const r=await f.post({...price,kind:['price']});
 assert.equal(r.status,503);assert.equal(f.saves(),0);assert.deepEqual(f.store.watches,[]);
});
