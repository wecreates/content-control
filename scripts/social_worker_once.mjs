import {EncryptedSocialStore, SocialAutomation} from '../social-automation.js';
import {createInstagramAdapter} from '../integrations/social-automation/instagram-adapter.mjs';
import {SocialReadWorker} from '../integrations/social-automation/worker.mjs';
import fs from 'node:fs/promises';
// Owner-controlled execution only. No grant import, browser password handling,
// public mutation endpoint, scheduling side effects, or secret output.
try {
  if (process.env.PUBLICATION_ENABLED && process.env.PUBLICATION_ENABLED !== 'false') throw Error();
  const store = new EncryptedSocialStore({file: process.env.SOCIAL_VAULT_FILE, key: process.env.SOCIAL_VAULT_KEY});
  await fs.access(store.file); // Never manufacture an empty production vault.
  const saved = await store.read();
  if (!Object.keys(saved.connections).length) throw Error();
  const runtime = new SocialAutomation({store, adapters: {instagram: createInstagramAdapter({appSecret: process.env.META_APP_SECRET})}});
  const result = await new SocialReadWorker({runtime}).cycle();
  console.log(JSON.stringify(result));
  // Success means this cycle executed; blocked/retry jobs are not success.
  if (result.status !== 'CYCLE_COMPLETED' || !result.counts?.completed || result.counts?.blocked || result.counts?.retry || result.counts?.queued) process.exitCode = 2;
} catch {console.log(JSON.stringify({status: 'BLOCKED', reason: 'PRIVATE_AUTHORIZED_VAULT_REQUIRED', publication_enabled: false})); process.exitCode = 2;}
