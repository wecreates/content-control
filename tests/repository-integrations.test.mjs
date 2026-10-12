import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRepositoryIntegrationRouter} from '../repository-integrations.js';

async function request(root){
  const app=express();
  app.use('/api/integrations',createRepositoryIntegrationRouter({moneyFactoryRoot:root}));
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

test('source configuration does not imply runtime health or expose private paths',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'cyzor-integration-route-'));
  try{
    await fs.mkdir(path.join(root,'integrations'));
    await fs.writeFile(path.join(root,'integrations/run.py'),'# worker fixture');
    await fs.writeFile(path.join(root,'integrations/repositories.json'),JSON.stringify({schema_version:1,
      repositories:Array.from({length:7},(_,i)=>({id:`tool-${i}`,order:i+1,revision:'abc',capability:'test',
        token:'DO_NOT_EXPOSE',path:'/private/worker',runtime_status:'ready'}))}));
    const {status,body}=await request(root);
    assert.equal(status,200);
    assert.equal(body.production_ready,false);
    assert.equal(body.repositories[0].runtime_status,'LIVE_EXECUTION_NOT_CHECKED_BY_THIS_ENDPOINT');
    assert.ok(!JSON.stringify(body).includes('DO_NOT_EXPOSE'));
    assert.ok(!JSON.stringify(body).includes('/private/worker'));
    await fs.writeFile(path.join(root,'integrations/repositories.json'),'{}');
    assert.equal((await request(root)).status,503);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
