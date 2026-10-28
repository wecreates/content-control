import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {offlineBridgeStatus} from '../repository-reel-status.js';
import {createRepositoryIntegrationRouter} from '../repository-integrations.js';

const entry={id:'open-seo',revision:'a'.repeat(40),operations:['readiness','import-serp'],
  path:'/private/do-not-expose',token:'SECRET',enabled:true,production_ready:true,runtime_status:'READY'};

test('registration never promotes unverified source into live readiness',()=>{
  const [status]=offlineBridgeStatus({external_bridges:[entry]});
  assert.equal(status.runtime_status,'OFFLINE_ADAPTER_REGISTERED_UPSTREAM_UNVERIFIED');
  assert.equal(status.production_ready,false);
  assert.equal(status.live_execution_enabled,false);
  assert.deepEqual(status.verified_operations,[]);
  assert.ok(!JSON.stringify(status).includes('SECRET'));
  assert.ok(!JSON.stringify(status).includes('/private'));
  assert.deepEqual(offlineBridgeStatus({}),[]);
});

test('duplicate IDs, malformed pins and unbounded operations fail closed',()=>{
  for(const entries of [[entry,entry],[{...entry,revision:'main'}],[{...entry,id:'unknown'}],
    [{...entry,operations:['readiness','readiness']}],[{...entry,operations:['run shell']}],null]) {
    assert.throws(()=>offlineBridgeStatus({external_bridges:entries}));
  }
});

test('array-valued revision cannot impersonate a source pin',()=>{
  assert.throws(()=>offlineBridgeStatus({external_bridges:[{...entry,revision:[entry.revision]}]}),
    /INVALID_BRIDGE_REGISTRY/);
  const [status]=offlineBridgeStatus({external_bridges:[entry]});
  assert.equal(status.revision,entry.revision);
  assert.equal(typeof status.revision,'string');
});

test('existing ContentControl status route exposes bridge without altering aggregate evidence',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'reel-status-'));
  const app=express();
  try {
    await fs.mkdir(path.join(root,'integrations'));
    await fs.writeFile(path.join(root,'integrations/run.py'),'# test fixture');
    await fs.writeFile(path.join(root,'integrations/repositories.json'),JSON.stringify({schema_version:1,
      repositories:Array.from({length:7},(_,i)=>({id:`legacy-${i}`})),external_bridges:[entry]}));
    app.use('/api/integrations',createRepositoryIntegrationRouter({moneyFactoryRoot:root,backend:'local'}));
    const server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    try {
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/integrations/status`);
      const body=await response.json();
      assert.equal(response.status,200);
      assert.equal(body.repositories.length,7);
      assert.equal(body.external_bridges[0].id,'open-seo');
      assert.equal(body.external_bridges[0].production_ready,false);
      assert.equal(body.production_ready,false);
    } finally { await new Promise(resolve=>server.close(resolve)); }
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
