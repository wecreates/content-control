import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {EncryptedSocialStore} from '../social-automation.js';
import {CustomerAccountRegistry} from '../integrations/social-automation/customer-registry.mjs';
import {CustomerAuthentication, CUSTOMER_COOKIE} from '../integrations/social-automation/customer-auth.mjs';
import {OWNER_COOKIE} from '../integrations/social-automation/owner-auth.mjs';
import {createCustomerRouter, customerConnectionPage} from '../integrations/social-automation/oauth-router.mjs';
import {initializeSocialService} from '../integrations/social-automation/hosted-service.mjs';

async function fixture(t, subject = 101) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'customer-auth-'));
  t.after(() => fs.rm(dir, {recursive:true, force:true}));
  const store = new EncryptedSocialStore({file:path.join(dir, 'vault'), key:'c'.repeat(64)});
  await store.update(() => {});
  let now = 100000;
  const calls = [];
  const registry = new CustomerAccountRegistry({store, identityPepper:'p'.repeat(32), now:() => now});
  const auth = new CustomerAuthentication({
    store,
    registry,
    origin:'https://example.test',
    clientId:'customer-client',
    clientSecret:'PRIVATE_CUSTOMER_CLIENT',
    now:() => now,
    fetchImpl:async(url, options) => {
      calls.push({url:String(url), options});
      return new Response(JSON.stringify(String(url).endsWith('/user') ? {id:subject} : {access_token:'PRIVATE_GITHUB_TOKEN', token_type:'bearer'}));
    },
  });
  return {dir, store, registry, auth, calls, clock:() => now, advance:ms => {now += ms;}};
}

async function login(auth) {
  const begin = await auth.begin();
  const state = new URL(begin.url).searchParams.get('state');
  return auth.complete({state, code:'code'}, begin.binding);
}

test('GitHub signup creates an isolated idempotent customer session without retaining raw identity or tokens', async t => {
  const x = await fixture(t);
  const begin = await x.auth.begin();
  const authorization = new URL(begin.url);
  assert.equal(authorization.origin, 'https://github.com');
  assert.equal(authorization.searchParams.get('allow_signup'), 'true');
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  const first = await x.auth.complete({state:authorization.searchParams.get('state'), code:'code'}, begin.binding);
  assert.equal(first.created, true);
  const request = {headers:{cookie:`${CUSTOMER_COOKIE}=${first.session}`}};
  const authorized = await x.auth.authorize(request);
  assert.match(authorized.customer_id, /^[0-9a-f-]{36}$/);
  await authorized.account.update(record => { record.jobs.push({id:'first-customer-job'}); });
  assert.deepEqual((await authorized.account.read()).jobs, [{id:'first-customer-job'}]);
  const repeated = await login(x.auth);
  assert.equal(repeated.created, false);
  const repeatedAccount = await x.auth.authorize({headers:{cookie:`${CUSTOMER_COOKIE}=${repeated.session}`}});
  assert.equal(repeatedAccount.customer_id, authorized.customer_id);
  assert.deepEqual((await repeatedAccount.account.read()).jobs, [{id:'first-customer-job'}]);
  assert.equal(x.calls.length, 4);
  assert.equal(new URLSearchParams(x.calls[0].options.body).get('code_verifier').length, 43);
  const decrypted = JSON.stringify(await x.store.read());
  for (const secret of ['"101"', first.session, repeated.session, 'PRIVATE_GITHUB_TOKEN', 'PRIVATE_CUSTOMER_CLIENT']) {
    assert.ok(!decrypted.includes(secret));
  }
  const encrypted = await fs.readFile(x.store.file, 'utf8');
  for (const secret of ['101', first.session, repeated.session, authorized.customer_id, 'PRIVATE_GITHUB_TOKEN']) {
    assert.ok(!encrypted.includes(secret));
  }
  await x.auth.logout(request);
  assert.equal(await x.auth.authorize(request), null);
});

test('failed identity, expired session and corrupt customer mapping fail closed', async t => {
  const wrong = await fixture(t, 0);
  const begin = await wrong.auth.begin();
  await assert.rejects(wrong.auth.complete({state:new URL(begin.url).searchParams.get('state'), code:'code'}, begin.binding), /CUSTOMER_AUTH_FAILED/);
  assert.equal((await wrong.store.read()).customer_accounts, undefined);
  const x = await fixture(t);
  const completed = await login(x.auth);
  const request = {headers:{cookie:`${CUSTOMER_COOKIE}=${completed.session}`}};
  const identity = await x.auth.authorize(request);
  await x.store.update(state => { delete Object.values(state.customer_sessions)[0].expires_at; });
  await assert.rejects(x.auth.authorize(request), /CUSTOMER_STORE_INTEGRITY_FAILED/);
  await x.store.update(state => { Object.values(state.customer_sessions)[0].expires_at = 28899999; });
  x.advance(28800001);
  assert.equal(await x.auth.authorize(request), null);
  await x.store.update(state => {
    state.customer_identity_index[state.customer_accounts[identity.customer_id].identity_hash] = crypto.randomUUID();
  });
  x.advance(-28800001);
  await assert.rejects(x.auth.authorize(request), /CUSTOMER_STORE_INTEGRITY_FAILED/);
});

test('one customer cannot exhaust another customer session capacity', async t => {
  const x = await fixture(t);
  const sessions = [];
  for (let index = 0; index < 10; index++) sessions.push(await login(x.auth));
  await assert.rejects(login(x.auth), /CUSTOMER_AUTH_CAPACITY/);
  const other = new CustomerAuthentication({
    store:x.store,
    registry:x.registry,
    origin:'https://example.test',
    clientId:'customer-client',
    clientSecret:'PRIVATE_CUSTOMER_CLIENT',
    now:x.clock,
    fetchImpl:async url => new Response(JSON.stringify(String(url).endsWith('/user') ? {id:202} : {access_token:'PRIVATE_OTHER_TOKEN', token_type:'bearer'})),
  });
  const otherLogin = await login(other);
  assert.equal(otherLogin.created, true);
  assert.notEqual((await other.authorize({headers:{cookie:`${CUSTOMER_COOKIE}=${otherLogin.session}`}})).customer_id,
    (await x.auth.authorize({headers:{cookie:`${CUSTOMER_COOKIE}=${sessions[0].session}`}})).customer_id);
  await x.auth.logout({headers:{cookie:`${CUSTOMER_COOKIE}=${sessions[0].session}`}});
  const recovered = await login(x.auth);
  assert.equal(recovered.created, false);
});

test('registration retained before a session-capacity failure is safe and idempotent on retry', async t => {
  const x = await fixture(t);
  await x.store.update(state => {
    state.customer_sessions = Object.fromEntries(Array.from({length:1000}, (_, index) => [
      crypto.createHash('sha256').update(String(index)).digest('hex'),
      {customer_id:crypto.randomUUID(), expires_at:28899999},
    ]));
  });
  await assert.rejects(login(x.auth), /CUSTOMER_AUTH_CAPACITY/);
  let state = await x.store.read();
  assert.equal(Object.keys(state.customer_accounts).length, 1);
  assert.equal(Object.keys(state.customer_sessions).length, 1000);
  await x.store.update(current => { delete current.customer_sessions[Object.keys(current.customer_sessions)[0]]; });
  const retry = await login(x.auth);
  assert.equal(retry.created, false);
  state = await x.store.read();
  assert.equal(Object.keys(state.customer_accounts).length, 1);
  assert.equal(Object.keys(state.customer_sessions).length, 1000);
});

test('customer HTTP boundary requires same origin and emits protected separate cookies', async t => {
  const x = await fixture(t);
  const service = {customerAuth:x.auth};
  const app = express();
  app.use('/api/social', createCustomerRouter(service));
  app.get('/social/customer', customerConnectionPage(service));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/social/customer/auth/start', {method:'POST'})).status, 403);
  let response = await fetch(base + '/api/social/customer/auth/start', {method:'POST', headers:{origin:x.auth.origin}, redirect:'manual'});
  assert.equal(response.status, 303);
  const pendingCookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
  const state = new URL(response.headers.get('location')).searchParams.get('state');
  response = await fetch(base + '/api/social/customer/auth/callback?' + new URLSearchParams({state, code:'code'}), {headers:{cookie:pendingCookie}, redirect:'manual'});
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/social/customer');
  const sessionCookie = response.headers.getSetCookie().find(value => value.startsWith(CUSTOMER_COOKIE + '=')).split(';')[0];
  assert.equal((await (await fetch(base + '/api/social/customer/auth/session', {headers:{cookie:sessionCookie}})).json()).authenticated, true);
  const page = await (await fetch(base + '/social/customer', {headers:{cookie:sessionCookie}})).text();
  assert.match(page, /Customer session verified/);
  for (const privateValue of ['PRIVATE_', 'customer_id', '101']) assert.ok(!page.includes(privateValue));
  response = await fetch(base + '/api/social/customer/auth/logout', {method:'POST', headers:{origin:x.auth.origin, cookie:sessionCookie}, redirect:'manual'});
  assert.equal(response.status, 303);
  assert.equal((await (await fetch(base + '/api/social/customer/auth/session', {headers:{cookie:sessionCookie}})).json()).authenticated, false);
  delete service.customerAuth;
  assert.equal((await fetch(base + '/api/social/customer/auth/session')).status, 503);
});

test('hosted customer signup initializes independently while owner-only routes remain unchanged', async t => {
  const x = await fixture(t);
  await x.store.update(state => { state.owner_sessions = {retained:{owner:'42', expires_at:999999}}; });
  const env = {
    SOCIAL_CUSTOMER_AUTH_ENABLED:'true',
    SOCIAL_STORAGE_MODE:'private_durable',
    SOCIAL_VAULT_FILE:x.store.file,
    SOCIAL_VAULT_KEY:'c'.repeat(64),
    SOCIAL_PUBLIC_ORIGIN:'https://example.test',
    CUSTOMER_GITHUB_CLIENT_ID:'customer-client',
    CUSTOMER_GITHUB_CLIENT_SECRET:'PRIVATE_CUSTOMER_CLIENT',
    CUSTOMER_IDENTITY_PEPPER:'p'.repeat(32),
  };
  const service = await initializeSocialService({env, now:() => 100000});
  t.after(() => service.stop());
  assert.equal(service.status().status, 'OAUTH_READY');
  assert.equal(service.status().owner_login_enabled, false);
  assert.equal(service.status().customer_signup_enabled, true);
  assert.equal(service.status().publication_enabled, false);
  assert.equal(service.ownerAuth, undefined);
  assert.ok(service.customerAuth);
  assert.deepEqual((await x.store.read()).owner_sessions, {retained:{owner:'42', expires_at:999999}});
  const blocked = await initializeSocialService({env:{...env, CUSTOMER_IDENTITY_PEPPER:'short'}, now:() => 100000});
  assert.equal(blocked.status().status, 'ACTIVATION_BLOCKED');
  assert.equal(blocked.status().reason_code, 'ACTIVATION_CONFIGURATION_INVALID');
  assert.equal(blocked.customerAuth, undefined);
});

test('combined owner and customer configuration keeps identities and cookies mutually unauthorized', async t => {
  const x = await fixture(t);
  const env = {
    SOCIAL_OAUTH_ENABLED:'true',
    SOCIAL_CUSTOMER_AUTH_ENABLED:'true',
    SOCIAL_STORAGE_MODE:'private_durable',
    SOCIAL_VAULT_FILE:x.store.file,
    SOCIAL_VAULT_KEY:'c'.repeat(64),
    SOCIAL_PUBLIC_ORIGIN:'https://example.test',
    OWNER_GITHUB_CLIENT_ID:'owner-client',
    OWNER_GITHUB_CLIENT_SECRET:'PRIVATE_OWNER_CLIENT',
    OWNER_GITHUB_ID:'42',
    CUSTOMER_GITHUB_CLIENT_ID:'customer-client',
    CUSTOMER_GITHUB_CLIENT_SECRET:'PRIVATE_CUSTOMER_CLIENT',
    CUSTOMER_IDENTITY_PEPPER:'p'.repeat(32),
  };
  const service = await initializeSocialService({env, now:() => 100000, fetchImpl:async url =>
    new Response(JSON.stringify(String(url).endsWith('/user') ? {id:42} : {access_token:'PRIVATE_LOGIN_TOKEN', token_type:'bearer'}))});
  t.after(() => service.stop());
  assert.equal(service.status().owner_login_enabled, true);
  assert.equal(service.status().customer_signup_enabled, true);
  const ownerBegin = await service.ownerAuth.begin();
  const ownerSession = await service.ownerAuth.complete({state:new URL(ownerBegin.url).searchParams.get('state'), code:'code'}, ownerBegin.binding);
  const customer = await login(service.customerAuth);
  assert.equal(await service.ownerAuth.authorize({headers:{cookie:`${CUSTOMER_COOKIE}=${customer.session}`}}), null);
  assert.equal(await service.customerAuth.authorize({headers:{cookie:`${OWNER_COOKIE}=${ownerSession}`}}), null);
  const ownerState = (await x.store.read()).owner_sessions;
  assert.equal(Object.keys(ownerState).length, 1);
  assert.equal(Object.values(ownerState)[0].owner, '42');
});
