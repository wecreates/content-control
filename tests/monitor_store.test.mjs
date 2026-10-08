import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,createWatch,deleteWatch,listWatches,applyCheck,serializeStore,hydrateStore} from '../monitor-store.js';

test('watch lifecycle is isolated by client',()=>{
  const s=createStore();
  const w=createWatch(s,{clientId:'a',kind:'change',targetUrl:'https://example.com/',label:'A'});
  assert.equal(listWatches(s,'a').length,1);
  assert.equal(listWatches(s,'b').length,0);
  assert.equal(deleteWatch(s,'b',w.id),false);
  assert.equal(deleteWatch(s,'a',w.id),true);
  assert.equal(listWatches(s,'a').length,0);
});

test('check updates timestamp and only emits change after baseline',()=>{
  const s=createStore();
  const w=createWatch(s,{clientId:'a',kind:'change',targetUrl:'https://example.com/',label:'A'});
  applyCheck(s,w.id,{hash:'one',checkedAt:100,status:200});
  assert.equal(s.events.length,0);
  applyCheck(s,w.id,{hash:'two',checkedAt:200,status:200});
  assert.equal(s.events.length,1);
  assert.equal(listWatches(s,'a')[0].last_checked_at,200);
});

test('store round-trips through backup serialization',()=>{
  const s=createStore();
  createWatch(s,{clientId:'a',kind:'change',targetUrl:'https://example.com/',label:'A'});
  const restored=hydrateStore(JSON.parse(serializeStore(s)));
  assert.equal(restored.watches.length,1);
  assert.equal(restored.watches[0].client_id,'a');
});


test('backup metadata round-trips with generation time',()=>{
  const s=createStore();
  createWatch(s,{clientId:'a',kind:'change',targetUrl:'https://example.com/',label:'A'});
  const raw=JSON.parse(serializeStore(s,{generatedAt:123}));
  assert.equal(raw.generated_at,123);
  const restored=hydrateStore(raw);
  assert.equal(restored.watches.length,1);
});
