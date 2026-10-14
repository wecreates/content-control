import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {loadMonitorStore,checkWatch} from '../monitor-runtime.js';
import {createStore,createWatch} from '../monitor-store.js';

async function fixture(t,handler){
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  return `http://127.0.0.1:${server.address().port}/`;
}
for(const stage of ['headers','body']){
  test(`startup restore returns safely when ${stage} stall`,{timeout:2000},async t=>{
    const url=await fixture(t,(_req,res)=>{
      if(stage==='body'){res.writeHead(200,{'content-type':'application/json'});res.write('{');}
    });
    const result=await loadMonitorStore({stateFile:'/nonexistent-cyzor-state',backupUrl:url,timeoutMs:50});
    assert.deepEqual(result,createStore());
  });
}
test('stalled watch body records failure without replacing previous baseline',{timeout:2000},async t=>{
  const url=await fixture(t,(_req,res)=>{res.writeHead(200);res.write('partial');});
  const store=createStore();
  const watch=createWatch(store,{clientId:'test',targetUrl:url});
  watch.last_value='accepted-baseline';
  const result=await checkWatch(store,watch.id,{persist:false,timeoutMs:50});
  assert.equal(result.ok,false);
  assert.equal(watch.last_value,'accepted-baseline');
  assert.equal(store.events.length,0);
});
test('healthy remote restore still hydrates state',{timeout:2000},async t=>{
  const url=await fixture(t,(_req,res)=>res.end(JSON.stringify({watches:[{id:'retained'}],events:[]})));
  const result=await loadMonitorStore({stateFile:'/nonexistent-cyzor-state',backupUrl:url,timeoutMs:500});
  assert.equal(result.watches[0].id,'retained');
});
