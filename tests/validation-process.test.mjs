import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {createValidationProcess} from '../validation-process.js';
test('missing interpreter cannot crash playback and permits a later validation',async()=>{
 const worker=createValidationProcess({spawnImpl:()=>spawn('/definitely-missing-python',[])});
 worker.run();await new Promise(r=>setTimeout(r,30));
 assert.equal(worker.state.status,'v2-validation-error');assert.equal(worker.running,false);
 assert.equal(worker.run(),true);await new Promise(r=>setTimeout(r,30));
});
test('hung validation is killed, duplicate calls refused, and log memory bounded',async()=>{
 const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 let killed=false;child.kill=signal=>{assert.equal(signal,'SIGKILL');killed=true;child.emit('close',null);};
 const worker=createValidationProcess({spawnImpl:(_cmd,_args,options)=>{assert.equal(options.env.PUBLICATION_ENABLED,'false');return child;},timeoutMs:10});
 worker.run();assert.equal(worker.run(),false);
 for(let i=0;i<100;i++)child.stdout.emit('data','x'.repeat(10000));
 assert.equal(worker.state.logs.length,40);assert.ok(worker.state.logs.every(x=>x.length<=4096));
 await new Promise(r=>setTimeout(r,30));assert.equal(killed,true);assert.equal(worker.running,false);assert.equal(worker.state.status,'v2-validation-error');
});
