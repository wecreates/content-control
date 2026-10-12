import fs from 'node:fs/promises';
import path from 'node:path';
import {EncryptedSocialStore, SocialAutomation, socialRuntimeReadiness} from '../../social-automation.js';
import {createProviderAdapters,providerReadiness} from './providers.mjs';
import {SocialReadWorker} from './worker.mjs';
import {SocialOAuthCoordinator} from './oauth-coordinator.mjs';
import {createYouTubeOAuth} from './google-oauth.mjs';

// No paid provisioning, fallback storage, auto-created vault or public import.
// Operator configuration is NOT independent proof of durable storage.
export async function initializeSocialService({env = process.env, fetchImpl = fetch, root = process.cwd(), authorizeOwner} = {}) {
  let worker,oauth;
  const shutdown = new AbortController();
  const status = {...socialRuntimeReadiness(env), configured_storage_mode: 'unconfigured', providers:providerReadiness()};
  const service = {
    status: () => ({...status, ...(worker ? {worker_running: worker.active, last_cycle: worker.status()} : {})}),
    beginAuthorization:async(platform,context)=>{if(!oauth)throw Error('OAUTH_NOT_CONFIGURED');return oauth.begin(platform,context);},
    completeAuthorization:async(platform,callback,context)=>{if(!oauth)throw Error('OAUTH_NOT_CONFIGURED');return oauth.complete(platform,callback,context);},
    stop: async () => {shutdown.abort(); if (worker) await worker.stop();},
  };
  if (env.SOCIAL_WORKER_ENABLED !== 'true') return service;
  try {
    if (env.PUBLICATION_ENABLED && env.PUBLICATION_ENABLED !== 'false') throw Error();
    if (env.SOCIAL_STORAGE_MODE !== 'private_durable') throw Error();
    if (!env.SOCIAL_VAULT_FILE || !path.isAbsolute(env.SOCIAL_VAULT_FILE)) throw Error();
    const file = await fs.realpath(env.SOCIAL_VAULT_FILE);
    const base = await fs.realpath(root);
    const relative = path.relative(base, file);
    if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw Error();
    const stat = await fs.stat(file);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw Error();
    const store = new EncryptedSocialStore({file, key: env.SOCIAL_VAULT_KEY});
    // A leftover lock requires deliberate recovery, never automatic deletion.
    try {await fs.access(file + '.lock'); throw Error('LOCKED');} catch (e) {if (e.code !== 'ENOENT') throw e;}
    const saved = await store.read();
    if (!Object.keys(saved.connections).length && typeof authorizeOwner!=='function') throw Error();
    const runtime = new SocialAutomation({store, adapters: createProviderAdapters({fetchImpl, shutdownSignal: shutdown.signal, appSecret: env.META_APP_SECRET})});
    const oauthProviders={};
    if(env.YOUTUBE_OAUTH_CLIENT_ID&&env.YOUTUBE_OAUTH_CLIENT_SECRET&&env.YOUTUBE_OAUTH_REDIRECT_URI&&env.YOUTUBE_CHANNEL_ID){
      const youtube=createYouTubeOAuth({clientId:env.YOUTUBE_OAUTH_CLIENT_ID,clientSecret:env.YOUTUBE_OAUTH_CLIENT_SECRET,redirectUri:env.YOUTUBE_OAUTH_REDIRECT_URI,accountId:env.YOUTUBE_CHANNEL_ID,fetchImpl});
      runtime.adapters.youtube.refresh=youtube.refresh;oauthProviders.youtube=youtube;
    }
    if(typeof authorizeOwner==='function')oauth=new SocialOAuthCoordinator({store,runtime,providers:oauthProviders,authorizeOwner});
    worker = new SocialReadWorker({runtime});
    Object.assign(status, {status: 'READ_WORKER_STARTED', configured_storage_mode: 'private_durable', provider_adapters_registered: Object.keys(runtime.adapters).filter(p=>!runtime.adapters[p].blocked_reason), reason: 'Read-only worker started; account results are reported per cycle. OAuth onboarding is unavailable and durable storage has not been independently verified.'});
    worker.start();
  } catch {
    Object.assign(status, {status: 'ACTIVATION_BLOCKED', reason: 'Private authorized vault, restrictive file permissions, and explicit private durable storage configuration are required; no fallback was created.'});
  }
  return service;
}
