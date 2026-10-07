import test from 'node:test';
import assert from 'node:assert/strict';

test('infrastructure status exposes only presence flags', async()=>{
  const {infraStatus}=await import('../monitor-infra.js');
  const out=infraStatus({DATABASE_URL:'secret',REDIS_URL:'secret2'});
  assert.deepEqual(out,{databaseUrlConfigured:true,redisUrlConfigured:true,githubTokenConfigured:false});
  assert.equal('DATABASE_URL' in out,false);
  assert.equal('REDIS_URL' in out,false);
});


test('infrastructure status detects GitHub token presence without exposing it', async()=>{
  const {infraStatus}=await import('../monitor-infra.js');
  const out=infraStatus({GITHUB_TOKEN:'hidden'});
  assert.equal(out.githubTokenConfigured,true);
  assert.equal('GITHUB_TOKEN' in out,false);
});
