import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {EncryptedSocialStore} from '../social-automation.js';
import {CustomerAccountRegistry} from '../integrations/social-automation/customer-registry.mjs';

async function fixture(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'customer-registry-'));
  t.after(() => fs.rm(dir, {recursive:true, force:true}));
  const file = path.join(dir, 'vault');
  const store = new EncryptedSocialStore({file, key:'a'.repeat(64)});
  let now = 100000;
  const registry = new CustomerAccountRegistry({store, identityPepper:'p'.repeat(32), now:() => now, ...options});
  const identity = subject => ({provider:'github', subject, verified:true, verified_at:now});
  return {file, store, registry, identity, advance:value => { now += value; }};
}

test('fresh verified identities create separate idempotent customer accounts without retaining raw subjects', async t => {
  const x = await fixture(t);
  const first = await x.registry.register(x.identity('101'));
  const second = await x.registry.register(x.identity('202'));
  const repeated = await x.registry.register(x.identity('101'));
  assert.equal(first.created, true);
  assert.equal(second.created, true);
  assert.notEqual(first.customer_id, second.customer_id);
  assert.deepEqual(repeated, {...first, created:false});
  const decrypted = JSON.stringify(await x.store.read());
  assert.ok(!decrypted.includes('"101"'));
  assert.ok(!decrypted.includes('"202"'));
  const encrypted = await fs.readFile(x.file, 'utf8');
  for (const privateValue of ['101', '202', first.customer_id, second.customer_id]) assert.ok(!encrypted.includes(privateValue));
});

test('customer-scoped stores isolate provider grants and jobs inside the encrypted vault', async t => {
  const x = await fixture(t);
  await x.registry.register(x.identity('101'));
  await x.registry.register(x.identity('202'));
  const first = await x.registry.open(x.identity('101'));
  const second = await x.registry.open(x.identity('202'));
  await first.update(record => {
    record.connections.youtube = {account_id:'FIRST_ACCOUNT', access_token:'PRIVATE_FIRST_TOKEN'};
    record.jobs.push({id:'first-job'});
  });
  await second.update(record => {
    record.connections.instagram = {account_id:'SECOND_ACCOUNT', access_token:'PRIVATE_SECOND_TOKEN'};
    record.jobs.push({id:'second-job'});
  });
  const firstView = await first.read();
  const secondView = await second.read();
  assert.deepEqual(Object.keys(firstView.connections), ['youtube']);
  assert.deepEqual(Object.keys(secondView.connections), ['instagram']);
  assert.deepEqual(firstView.jobs.map(job => job.id), ['first-job']);
  assert.deepEqual(secondView.jobs.map(job => job.id), ['second-job']);
  assert.ok(!JSON.stringify(firstView).includes('SECOND_ACCOUNT'));
  assert.ok(!JSON.stringify(secondView).includes('FIRST_ACCOUNT'));
  const encrypted = await fs.readFile(x.file, 'utf8');
  for (const privateValue of ['FIRST_ACCOUNT', 'SECOND_ACCOUNT', 'PRIVATE_FIRST_TOKEN', 'PRIVATE_SECOND_TOKEN']) {
    assert.ok(!encrypted.includes(privateValue));
  }
});

test('unverified, stale and malformed identities fail before registration', async t => {
  const x = await fixture(t);
  const valid = x.identity('101');
  for (const change of [
    {verified:false},
    {provider:'email'},
    {subject:'not-numeric'},
    {verified_at:0},
    {verified_at:100001},
  ]) await assert.rejects(x.registry.register({...valid, ...change}), /CUSTOMER_IDENTITY_REQUIRED/);
  x.advance(300001);
  await assert.rejects(x.registry.register(valid), /CUSTOMER_IDENTITY_REQUIRED/);
  const state = await x.store.read();
  assert.equal(state.customer_accounts, undefined);
});

test('corrupt identity indexes and cross-scope identity changes fail closed without altering owner state', async t => {
  const x = await fixture(t);
  await x.store.update(state => { state.owner_sessions = {retained:{owner:'42'}}; });
  const signup = await x.registry.register(x.identity('101'));
  const other = await x.registry.register(x.identity('202'));
  const scoped = await x.registry.open(x.identity('101'));
  await assert.rejects(scoped.update(record => { record.identity_hash = '0'.repeat(64); }), /CUSTOMER_SCOPE_VIOLATION|CUSTOMER_STORE_INTEGRITY_FAILED/);
  await x.store.update(state => {
    const otherIndex = Object.entries(state.customer_identity_index).find(([, id]) => id === other.customer_id)?.[0];
    assert.ok(otherIndex);
    state.customer_identity_index[otherIndex] = signup.customer_id;
  });
  await assert.rejects(x.registry.open(x.identity('202')), /CUSTOMER_STORE_INTEGRITY_FAILED/);
  const state = await x.store.read();
  assert.deepEqual(state.owner_sessions, {retained:{owner:'42'}});
});

test('capacity is enforced atomically', async t => {
  const x = await fixture(t, {maxCustomers:1});
  await x.registry.register(x.identity('101'));
  await assert.rejects(x.registry.register(x.identity('202')), /CUSTOMER_CAPACITY_REACHED/);
  assert.equal(Object.keys((await x.store.read()).customer_accounts).length, 1);
});
