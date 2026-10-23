import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createMonitorRouter} from '../monitor-api.js';
import {createStore,createWatch} from '../monitor-store.js';
import {checkWatch} from '../monitor-runtime.js';
const html=price=>`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',sku:'mug',offers:{'@type':'Offer',price,priceCurrency:'USD',availability:'https://schema.org/InStock'}})}</script>`;
const counts=db=>JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys\nc=sqlite3.connect(sys.argv[1]);print(json.dumps([c.execute('select count(*) from '+t).fetchone()[0] for t in ['price_states','price_outbox','price_tombstones']]))`,db],{encoding:'utf8'}));
async function fixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'pricewatch-delete-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const store=createStore(),db=path.join(root,'price.sqlite');let failSave=false;
 const w=createWatch(store,{clientId:'client-one',kind:'price',targetUrl:'https://shop.example.test/item',priceCurrency:'USD'});
 const options={priceDbPath:db,saveStore:async()=>{if(failSave)throw Error('injected');}};
 const run=(n,amount,extra={})=>checkWatch(store,w.id,{...options,persist:false,priceCheckId:`check-${n}`,priceCheckedAt:`2026-10-22T12:00:${String(n).padStart(2,'0')}Z`,fetchPricePage:async()=>({verified:true,finalUrl:w.target_url,html:html(amount)}),...extra});
 await run(1,'30');await run(2,'20');const original=structuredClone(w);
 const app=express();app.use('/ext',createMonitorRouter(store,{...options,enablePriceWatches:true}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}/ext`;
 return {store,db,w,run,original,base,setFailSave:x=>failSave=x,delete:cid=>fetch(`${base}/watch/${w.id}?clientId=${cid??'client-one'}`,{method:'DELETE'})};
}
test('actual delete API removes price state and outbox, retries safely',async t=>{
 const f=await fixture(t);assert.deepEqual(counts(f.db),[1,1,0]);assert.equal((await f.delete()).status,200);assert.deepEqual(counts(f.db),[0,0,1]);assert.deepEqual(await (await f.delete()).json(),{ok:true});
});
test('wrong client delete cannot touch another client',async t=>{
 const f=await fixture(t);assert.deepEqual(await (await f.delete('client-two')).json(),{ok:false});assert.deepEqual(counts(f.db),[1,1,0]);
});
test('deletion while fetch is pending leaves no price history or event',async t=>{
 const f=await fixture(t);let release,started;const pending=new Promise(r=>started=r);
 const p=f.run(3,'10',{fetchPricePage:async()=>{started();return new Promise(r=>release=r);}});await pending;
 assert.equal((await f.delete()).status,200);release({verified:true,finalUrl:f.w.target_url,html:html('10')});assert.equal((await p).ok,false);assert.deepEqual(counts(f.db),[0,0,1]);
});
test('stale restored watch cannot fetch and is removed before API listing',async t=>{
 const f=await fixture(t);await f.delete();f.store.watches.push(structuredClone(f.original));f.store.events.push({id:'stale-event',client_id:'client-one',watch_id:f.w.id,type:'change'});
 let fetches=0;const r=await checkWatch(f.store,f.w.id,{persist:false,priceDbPath:f.db,fetchPricePage:async()=>{fetches++;throw Error();}});assert.equal(r.reason,'price_watch_deleted');assert.equal(fetches,0);
 assert.deepEqual((await (await fetch(f.base+'/watch?clientId=client-one')).json()).watches,[]);assert.deepEqual((await (await fetch(f.base+'/events?clientId=client-one')).json()).events,[]);assert.deepEqual(counts(f.db),[0,0,1]);
});
test('metadata save failure after tombstone returns failure, retry and stale reconciliation stay safe',async t=>{
 const f=await fixture(t);f.setFailSave(true);assert.equal((await f.delete()).status,503);assert.deepEqual(counts(f.db),[0,0,1]);
 f.store.watches.push(structuredClone(f.original));assert.equal((await fetch(f.base+'/watch?clientId=client-one')).status,503);
 f.setFailSave(false);assert.deepEqual(await (await f.delete()).json(),{ok:true});assert.deepEqual((await (await fetch(f.base+'/watch?clientId=client-one')).json()).watches,[]);
});

test('legacy generic client scopes and malformed event IDs do not poison listings',async t=>{
 const f=await fixture(t);
 const legacy=createWatch(f.store,{clientId:'alice@example.com',kind:'change',targetUrl:'https://shop.example.test/generic'});
 f.store.events.push({id:'legacy-event',client_id:'alice@example.com',watch_id:legacy.id,type:'change'});
 let response=await fetch(f.base+'/watch?clientId='+encodeURIComponent('alice@example.com'));assert.equal(response.status,200);assert.equal((await response.json()).watches.length,1);
 response=await fetch(f.base+'/events?clientId='+encodeURIComponent('alice@example.com'));assert.equal(response.status,200);assert.equal((await response.json()).events.length,1);
 f.store.events.push({id:'bad-id-event',client_id:'client-one',watch_id:'legacy id with spaces',type:'change'});
 response=await fetch(f.base+'/events?clientId=client-one');assert.equal(response.status,200);assert.equal((await response.json()).events.length,1);
});
