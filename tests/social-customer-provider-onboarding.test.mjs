import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {EncryptedSocialStore, SocialAutomation} from '../social-automation.js';
import {CustomerAccountRegistry} from '../integrations/social-automation/customer-registry.mjs';
import {CustomerProviderOnboarding} from '../integrations/social-automation/customer-provider-onboarding.mjs';

async function fixture(t, subject = '101') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'customer-provider-'));
  t.after(() => fs.rm(dir, {recursive:true, force:true}));
  const store = new EncryptedSocialStore({file:path.join(dir, 'vault'), key:'a'.repeat(64)});
  await store.update(() => {});
  let now = 100000;
  const registry = new CustomerAccountRegistry({store, identityPepper:'p'.repeat(32), now:() => now});
  const registration = await registry.register({provider:'github', subject, verified:true, verified_at:now});
  const account = await registry.openRegisteredCustomer(registration.customer_id);
  const request = {headers:{cookie:'opaque'}};
  const customerAuth = {authorize:async context => context === request ? {customer_id:registration.customer_id, account} : null};
  let providerReads = 0;
  const providers = {youtube:{
    authorizationUrl:({state}) => `https://accounts.example.test/authorize?state=${state}`,
    exchange:async() => ({account_id:'channel-1', access_token:'PRIVATE_ACCESS', scopes:['read'], expires_at:now + 3600000}),
  }};
  const adapters = {youtube:{
    verify:async grant => ({account_id:grant.account_id, verified:true}),
    read_profile:async grant => {
      providerReads++;
      if (providerReads === 1) throw Error('PROVIDER_FAILED');
      return {account_id:grant.account_id, full_analysis:false};
    },
  }};
  const onboarding = new CustomerProviderOnboarding({customerAuth, registry, providers, adapters, now:() => now});
  return {store, account, request, onboarding, advance:ms => {now += ms;}, reads:() => providerReads};
}

test('customer provider connection is scoped, verified, queued and secret-safe', async t => {
  const x = await fixture(t);
  const begin = await x.onboarding.begin('youtube', x.request);
  const state = new URL(begin.authorization_url).searchParams.get('state');
  const connected = await x.onboarding.complete('youtube', {state, code:'code'}, x.request);
  assert.deepEqual(connected, {platform:'youtube', connection_status:'VERIFIED', first_read_job_status:'QUEUED', publication_enabled:false, external_writes_enabled:false});
  const progress = await x.onboarding.status(x.request);
  assert.deepEqual(progress.providers, [{platform:'youtube', status:'VERIFIED', first_read_job_status:'QUEUED', attempts:0}]);
  assert.equal(progress.publication_enabled, false);
  const encrypted = await fs.readFile(x.store.file, 'utf8');
  for (const privateValue of ['PRIVATE_ACCESS', 'channel-1']) assert.ok(!encrypted.includes(privateValue));
  const root = await x.store.read();
  assert.deepEqual(root.connections, {});
  assert.deepEqual(root.jobs, []);
});

test('first customer read retains retry then completes without browser-supplied operation', async t => {
  const x = await fixture(t);
  const begin = await x.onboarding.begin('youtube', x.request);
  await x.onboarding.complete('youtube', {state:new URL(begin.authorization_url).searchParams.get('state'), code:'code'}, x.request);
  let progress = await x.onboarding.runOnce(x.request);
  assert.equal(x.reads(), 1);
  assert.equal(progress.providers[0].first_read_job_status, 'RETRY_PENDING');
  assert.equal(progress.providers[0].attempts, 1);
  assert.equal(progress.providers[0].reason, 'PROVIDER_FAILED');
  x.advance(120000);
  progress = await x.onboarding.runOnce(x.request);
  assert.equal(x.reads(), 2);
  assert.equal(progress.providers[0].first_read_job_status, 'COMPLETED');
  assert.equal(progress.providers[0].attempts, 2);
  assert.equal(progress.providers[0].reason, undefined);
  const state = await x.account.read();
  assert.equal(state.jobs.length, 1);
  assert.equal(state.jobs[0].operation, 'read_profile');
  assert.equal(state.jobs[0].status, 'completed');
  assert.equal(state.jobs[0].result.account_id, 'channel-1');
});

test('customer identity cannot cross into another scoped OAuth transaction', async t => {
  const x = await fixture(t);
  const begin = await x.onboarding.begin('youtube', x.request);
  await assert.rejects(x.onboarding.complete('youtube', {state:new URL(begin.authorization_url).searchParams.get('state'), code:'code'}, {headers:{cookie:'other'}}), /CUSTOMER_AUTH_REQUIRED/);
  const state = await x.account.read();
  assert.deepEqual(state.connections, {});
  assert.deepEqual(state.jobs, []);
});

test('bounded worker repairs a retained verified connection missing its first job', async t => {
  const x = await fixture(t);
  const begin = await x.onboarding.begin('youtube', x.request);
  await x.onboarding.complete('youtube', {state:new URL(begin.authorization_url).searchParams.get('state'), code:'code'}, x.request);
  await x.account.update(state => { state.jobs = []; });
  let result = await x.onboarding.runDue();
  assert.deepEqual(result, {processed:1, failed:0, publication_enabled:false, external_writes_enabled:false});
  let state = await x.account.read();
  assert.equal(state.jobs.length, 1);
  assert.equal(state.jobs[0].status, 'retry');
  x.advance(120000);
  result = await x.onboarding.runDue();
  assert.equal(result.processed, 1);
  state = await x.account.read();
  assert.equal(state.jobs.length, 1);
  assert.equal(state.jobs[0].status, 'completed');
});

test('reconnect status waits for a successful read on the new grant', async t => {
  const x = await fixture(t);
  const begin = await x.onboarding.begin('youtube', x.request);
  await x.onboarding.complete('youtube', {state:new URL(begin.authorization_url).searchParams.get('state'), code:'code'}, x.request);
  await x.onboarding.runOnce(x.request);
  x.advance(120000);
  await x.onboarding.runOnce(x.request);
  const {connections, jobs} = await x.account.read();
  assert.equal(jobs[0].status, 'completed');

  // Persist the verified reconnect, as if the callback stopped before enqueueing.
  const runtime = new SocialAutomation({store:x.account, adapters:x.onboarding.adapters, now:x.onboarding.now});
  await runtime.connect('youtube', connections.youtube);
  assert.deepEqual((await x.onboarding.status(x.request)).providers, [{
    platform:'youtube', status:'VERIFIED', first_read_job_status:'NOT_QUEUED', attempts:0,
  }]);

  await x.onboarding.runDue();
  assert.deepEqual((await x.onboarding.status(x.request)).providers, [{
    platform:'youtube', status:'VERIFIED', first_read_job_status:'COMPLETED', attempts:1,
  }]);
  assert.equal((await x.account.read()).jobs.length, 2);

  x.advance(3600000);
  assert.deepEqual((await x.onboarding.status(x.request)).providers, [{
    platform:'youtube', status:'REAUTHORIZATION_REQUIRED', first_read_job_status:'NOT_QUEUED', attempts:0,
  }]);
});
