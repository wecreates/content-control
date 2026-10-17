import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {monitorPodPool} from '../integrations/pod/pool-health.mjs';

test('idle pool errors are handled and expose only fixed diagnostics',()=>{
 const pool=new EventEmitter(),health=monitorPodPool(pool);
 assert.deepEqual(health(),{idle_connection_failures:0,last_idle_connection_failure_at:null,last_error_code:null});
 const privateError=Error('postgresql://private-user:private-password@private-host/db');
 privateError.detail='private database contents';
 assert.doesNotThrow(()=>pool.emit('error',privateError,{secret:'private client state'}));
 const snapshot=health();
 assert.equal(snapshot.idle_connection_failures,1);
 assert.equal(snapshot.last_error_code,'POD_DATABASE_IDLE_CONNECTION_FAILED');
 assert.ok(Number.isFinite(Date.parse(snapshot.last_idle_connection_failure_at)));
 assert.equal(JSON.stringify(snapshot).includes('private'),false);
});
test('repeat attachment does not double count and snapshots cannot mutate monitoring',()=>{
 const pool=new EventEmitter(),health=monitorPodPool(pool);
 assert.equal(monitorPodPool(pool),health);assert.equal(pool.listenerCount('error'),1);
 pool.emit('error',Error('first'));const snapshot=health();snapshot.idle_connection_failures=100;
 pool.emit('error',Error('second'));
 assert.equal(health().idle_connection_failures,2);
});
test('pool failures remain isolated and do not claim successful recovery',()=>{
 const a=new EventEmitter(),b=new EventEmitter(),ah=monitorPodPool(a),bh=monitorPodPool(b);
 a.emit('error',Error('disconnected'));a.emit('connect',{});a.emit('acquire',{});
 assert.equal(ah().idle_connection_failures,1);assert.equal(bh().idle_connection_failures,0);
 assert.equal(ah().last_error_code,'POD_DATABASE_IDLE_CONNECTION_FAILED');
});
