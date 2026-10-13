import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeView} from '../social-ui/runtime-view.mjs';

test('dashboard never treats missing policy, storage or configuration as verified', () => {
  const result = runtimeView();
  assert.equal(result.locked, false);
  assert.match(result.storage, /not been verified/);
  assert.equal(result.expiry, null);
});
test('expiry blocks storage display even when historical bootstrap succeeded', () => {
  const result = runtimeView({publication_enabled:false, external_writes_enabled:false, storage_bootstrap:{read_verified:true}, storage_health:{operations_blocked:true, reason_code:'STORAGE_EXPIRING'}, storage_expires_at:'2026-10-26T20:02:09.446Z'});
  assert.equal(result.locked, true);
  assert.match(result.storage, /blocked.*STORAGE_EXPIRING/);
  assert.equal(result.expiry, '2026-10-26T20:02:09.446Z');
});
test('successful startup and present settings do not imply ongoing availability or account authorization', () => {
  const result = runtimeView({storage_bootstrap:{read_verified:true,checked_at:'2026-10-13T21:00:00Z'},authorization_configuration:{owner:{missing_configuration:['OWNER_GITHUB_CLIENT_ID']},youtube:{missing_configuration:[]}}});
  assert.match(result.storage,/at startup/);
  assert.match(result.scope,/not proven/);
  assert.match(result.authorization[0].text,/OWNER_GITHUB_CLIENT_ID/);
  assert.match(result.authorization[1].text,/requires verification/);
});
