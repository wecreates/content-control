import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentFailure} from '../scripts/pod_deploy_database.mjs';
test('diagnostics never disclose credentials or SQL',()=>{
 const secret='postgres://owner:private-password@database';
 for(const error of [Error(secret),{code:secret,message:secret},{message:'28000 '+secret},null])
  assert.deepEqual(deploymentFailure(error),{status:'BLOCKED',reason:'POD_DATABASE_DEPLOYMENT_FAILED',publication_enabled:false});
 for(const code of ['42501','28P01','ECONNRESET']){
  assert.equal(deploymentFailure({code,message:secret,detail:secret,query:secret}).reason,code);
  assert.ok(!JSON.stringify(deploymentFailure({code,message:secret})).includes(secret));
 }
 assert.equal(deploymentFailure(Error('Connection terminated unexpectedly')).reason,'DATABASE_CONNECTION_TERMINATED');
 assert.equal(deploymentFailure(Error('STORAGE_EXPIRING')).reason,'STORAGE_EXPIRING');
});
