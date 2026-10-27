import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRepositoryIntegrationRouter} from '../repository-integrations.js';
import {createHostedWorkerStatus} from '../repository-worker-status.js';

async function request(root,options={}){
  const app=express();
  app.use('/api/integrations',createRepositoryIntegrationRouter({moneyFactoryRoot:root,backend:'local',...options}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/integrations/status`);
    return {status:response.status,body:await response.json()};
  }finally{await new Promise(resolve=>server.close(resolve));}
}

test('missing hosted worker cannot become production ready',async()=>{
  const {status,body}=await request('');
  assert.equal(status,503);
  assert.equal(body.status,'WORKER_NOT_CONFIGURED');
  assert.equal(body.production_ready,false);
  assert.equal(body.publication_enabled,false);
});

test('hosted evidence diagnostic remains HTTP 503 and exposes no upstream details',async()=>{
  const hostedStatus=createHostedWorkerStatus({fetchImpl:async()=>{
    throw Object.assign(new Error('private upstream URL and credentials'),{name:'TimeoutError'});
  }});
  const {status,body}=await request('',{backend:'github-actions',hostedStatus});
  assert.equal(status,503);
  assert.equal(body.status,'HOSTED_EVIDENCE_UNAVAILABLE');
  assert.equal(body.evidence_error_code,'UPSTREAM_TIMEOUT');
  assert.equal(body.production_ready,false);
  assert.equal(body.publication_enabled,false);
  assert.equal(body.paid_generation_enabled,false);
  assert.ok(!JSON.stringify(body).includes('private'));
});

test('hosted HTTP preserves original status while exposing independent aggregate verification',async()=>{
  for(const aggregate_status of [undefined,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED','HOSTED_REQUIRED_OPERATIONS_VERIFIED']) {
    const status={status:'HOSTED_CPU_OPERATIONS_VERIFIED',aggregate_status,
      expected_operation_count:20,verified_operation_count:aggregate_status==='HOSTED_REQUIRED_OPERATIONS_VERIFIED'?20:8,
      production_ready:false,publication_enabled:false};
    const response=await request('',{backend:'github-actions',hostedStatus:async()=>status});
    assert.equal(response.status,200);
    assert.equal(response.body.status,'HOSTED_CPU_OPERATIONS_VERIFIED');
    assert.equal(response.body.aggregate_status,aggregate_status);
    assert.equal(response.body.verified_operation_count,status.verified_operation_count);
    assert.equal(response.body.production_ready,false);
    assert.equal(response.body.publication_enabled,false);
  }
});

test('source configuration does not imply runtime health or expose private paths',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'cyzor-integration-route-'));
  try{
    await fs.mkdir(path.join(root,'integrations'));
    await fs.writeFile(path.join(root,'integrations/run.py'),'# worker fixture');
    await fs.writeFile(path.join(root,'integrations/repositories.json'),JSON.stringify({schema_version:1,
      agent_tools:[{id:'youtube-agent-skill',revision:'abc',path:'/private/skill',runtime_status:'CLAIMED_READY'}],
      repositories:Array.from({length:7},(_,i)=>({id:`tool-${i}`,order:i+1,revision:'abc',capability:'test',
        token:'DO_NOT_EXPOSE',path:'/private/worker',runtime_status:'ready'}))}));
    const {status,body}=await request(root);
    assert.equal(status,200);
    assert.equal(body.production_ready,false);
    assert.equal(body.repositories[0].runtime_status,'LIVE_EXECUTION_NOT_CHECKED_BY_THIS_ENDPOINT');
    assert.equal(body.additional_tools[0].id,'youtube-agent-skill');
    assert.equal(body.additional_tools[0].runtime_status,'LIVE_EXECUTION_NOT_CHECKED_BY_THIS_ENDPOINT');
    assert.deepEqual(body.additional_tools[0].verified_operations,[]);
    assert.ok(!JSON.stringify(body).includes('DO_NOT_EXPOSE'));
    assert.ok(!JSON.stringify(body).includes('/private/worker'));
    await fs.writeFile(path.join(root,'integrations/repositories.json'),'{}');
    assert.equal((await request(root)).status,503);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
