import test from 'node:test';
import assert from 'node:assert/strict';
import {initializePodService} from '../integrations/pod/service.mjs';

const disabledEnv=()=>({
 POD_SERVICE_ENABLED:'false',
 POD_PRODUCTION_ENABLED:'false',
 POD_OUTBOX_ENABLED:'false'
});

test('POD service rejects executable startup configuration without invocation',async()=>{
 let reads=0;
 for(const key of ['env','authorize','production']){
  const options={};
  Object.defineProperty(options,key,{enumerable:true,get(){reads++;throw Error('service option getter executed');}});
  await assert.rejects(initializePodService(options),/^Error: POD_SERVICE_OPTIONS_UNVERIFIED$/,key);
 }
 const proxyOptions=new Proxy({},{get(){reads++;throw Error('service option proxy executed');}});
 await assert.rejects(initializePodService(proxyOptions),/^Error: POD_SERVICE_OPTIONS_UNVERIFIED$/);

 for(const key of ['POD_SERVICE_ENABLED','POD_PRODUCTION_ENABLED']){
  const env=disabledEnv();
  Object.defineProperty(env,key,{enumerable:true,get(){reads++;throw Error('service environment getter executed');}});
  await assert.rejects(initializePodService({env}),/^Error: POD_SERVICE_ENV_UNVERIFIED$/,key);
 }
 const proxyEnv=new Proxy(disabledEnv(),{
  get(){reads++;throw Error('service environment proxy executed');},
  getPrototypeOf(){reads++;throw Error('service environment proxy executed');},
  ownKeys(){reads++;throw Error('service environment proxy executed');}
 });
 await assert.rejects(initializePodService({env:proxyEnv}),/^Error: POD_SERVICE_ENV_UNVERIFIED$/);
 assert.equal(reads,0);
});
