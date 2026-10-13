import fs from 'node:fs/promises';
import path from 'node:path';
import {EncryptedSocialStore, SocialAutomation, socialRuntimeReadiness} from '../../social-automation.js';
import {createProviderAdapters,providerReadiness} from './providers.mjs';
import {SocialReadWorker} from './worker.mjs';
import {SocialOAuthCoordinator} from './oauth-coordinator.mjs';
import {createYouTubeOAuth} from './google-oauth.mjs';
import {createInstagramOAuth} from './meta-oauth.mjs';
import {OwnerAuthentication} from './owner-auth.mjs';
import {createPostgresStore} from './postgres-store.mjs';

// No paid provisioning, fallback storage, auto-created vault or public import.
// Operator configuration is NOT independent proof of durable storage.
export async function initializeSocialService({env = process.env, fetchImpl = fetch, root = process.cwd(), authorizeOwner} = {}) {
  let worker,oauth,store;
  let activationStage = 'policy';
  const shutdown = new AbortController();
  const status = {...socialRuntimeReadiness(env), configured_storage_mode: 'unconfigured', providers:providerReadiness()};
  const service = {
    status: () => ({...status, ...(worker ? {worker_running: worker.active, last_cycle: worker.status()} : {})}),
    beginAuthorization:async(platform,context)=>{if(shutdown.signal.aborted)throw Error('OAUTH_STOPPED');if(!oauth)throw Error('OAUTH_NOT_CONFIGURED');return oauth.begin(platform,context);},
    completeAuthorization:async(platform,callback,context)=>{if(shutdown.signal.aborted)throw Error('OAUTH_STOPPED');if(!oauth)throw Error('OAUTH_NOT_CONFIGURED');return oauth.complete(platform,callback,context);},
    stop: async () => {shutdown.abort(); if (worker) await worker.stop(); if(store?.close)await store.close();},
  };
  if (env.SOCIAL_WORKER_ENABLED !== 'true' && env.SOCIAL_OAUTH_ENABLED !== 'true') return service;
  try {
    if (env.PUBLICATION_ENABLED && env.PUBLICATION_ENABLED !== 'false') throw Error('PUBLICATION_POLICY_BLOCKED');
    activationStage = 'storage_configuration';
    if(env.SOCIAL_STORAGE_MODE === 'postgres_encrypted') {
      store=createPostgresStore(env);
    } else {
    if (env.SOCIAL_STORAGE_MODE !== 'private_durable') throw Error();
    if (!env.SOCIAL_VAULT_FILE || !path.isAbsolute(env.SOCIAL_VAULT_FILE)) throw Error();
    const file = await fs.realpath(env.SOCIAL_VAULT_FILE);
    const base = await fs.realpath(root);
    const relative = path.relative(base, file);
    if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw Error();
    const stat = await fs.stat(file);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw Error();
    store = new EncryptedSocialStore({file, key: env.SOCIAL_VAULT_KEY});
    // A leftover lock requires deliberate recovery, never automatic deletion.
    try {await fs.access(file + '.lock'); throw Error('LOCKED');} catch (e) {if (e.code !== 'ENOENT') throw e;}
    }
    activationStage = 'storage_read';
    const saved = await store.read();
    activationStage = 'owner_configuration';
    let ownerAuth;
    if (env.SOCIAL_OAUTH_ENABLED === 'true') {
      ownerAuth = new OwnerAuthentication({store, origin: env.SOCIAL_PUBLIC_ORIGIN, clientId: env.OWNER_GITHUB_CLIENT_ID, clientSecret: env.OWNER_GITHUB_CLIENT_SECRET, ownerId: env.OWNER_GITHUB_ID, fetchImpl, shutdownSignal: shutdown.signal});
      authorizeOwner = req => ownerAuth.authorize(req);
    }
    if (!Object.keys(saved.connections).length && typeof authorizeOwner!=='function') throw Error();
    const runtime = new SocialAutomation({store, adapters: createProviderAdapters({fetchImpl, shutdownSignal: shutdown.signal, appSecret: env.META_APP_SECRET})});
    activationStage = 'provider_configuration';
    const oauthProviders={};
    if(env.YOUTUBE_OAUTH_CLIENT_ID&&env.YOUTUBE_OAUTH_CLIENT_SECRET&&env.YOUTUBE_OAUTH_REDIRECT_URI&&env.YOUTUBE_CHANNEL_ID){
      if(ownerAuth && env.YOUTUBE_OAUTH_REDIRECT_URI !== ownerAuth.origin + '/api/social/oauth/youtube/callback') throw Error();
      const youtube=createYouTubeOAuth({clientId:env.YOUTUBE_OAUTH_CLIENT_ID,clientSecret:env.YOUTUBE_OAUTH_CLIENT_SECRET,redirectUri:env.YOUTUBE_OAUTH_REDIRECT_URI,accountId:env.YOUTUBE_CHANNEL_ID,fetchImpl,shutdownSignal:shutdown.signal});
      runtime.adapters.youtube.refresh=youtube.refresh;oauthProviders.youtube=youtube;
    }
    if(env.META_APP_ID && env.META_APP_SECRET && env.INSTAGRAM_OAUTH_REDIRECT_URI && env.INSTAGRAM_ACCOUNT_ID) {
      if(ownerAuth && env.INSTAGRAM_OAUTH_REDIRECT_URI !== ownerAuth.origin + '/api/social/oauth/instagram/callback') throw Error();
      oauthProviders.instagram=createInstagramOAuth({clientId:env.META_APP_ID,clientSecret:env.META_APP_SECRET,redirectUri:env.INSTAGRAM_OAUTH_REDIRECT_URI,accountId:env.INSTAGRAM_ACCOUNT_ID,fetchImpl,shutdownSignal:shutdown.signal});
    }
    if(typeof authorizeOwner==='function')oauth=new SocialOAuthCoordinator({store,runtime,providers:oauthProviders,authorizeOwner,shutdownSignal:shutdown.signal});
    service.ownerAuth = ownerAuth;
    Object.assign(status, {oauth_routes_enabled: Boolean(ownerAuth), owner_login_enabled: Boolean(ownerAuth), oauth_providers: Object.keys(oauthProviders), configured_storage_mode: env.SOCIAL_STORAGE_MODE, storage_expires_at: env.SOCIAL_STORAGE_EXPIRES_AT || null, status: 'OAUTH_READY', reason: 'Owner authorization routes configured; live grants and durable storage are not independently verified.'});
    if (env.SOCIAL_WORKER_ENABLED !== 'true') return service;
    worker = new SocialReadWorker({runtime});
    Object.assign(status, {status: 'READ_WORKER_STARTED', configured_storage_mode: env.SOCIAL_STORAGE_MODE, provider_adapters_registered: Object.keys(runtime.adapters).filter(p=>!runtime.adapters[p].blocked_reason), reason: 'Read-only worker started; account results are reported per cycle. OAuth availability is reported separately; durable storage has not been independently verified.'});
    worker.start();
  } catch (error) {
    const safeCodes = new Set(['PUBLICATION_POLICY_BLOCKED', 'PRIVATE_STORE_CONFIGURATION_REQUIRED', 'STORAGE_EXPIRY_REQUIRED', 'STORAGE_EXPIRING', 'PRIVATE_STORE_UNAVAILABLE', 'PRIVATE_STORE_NOT_INITIALIZED', 'PRIVATE_STORE_INTEGRITY_FAILED', 'OWNER_CONFIGURATION_REQUIRED', 'OAUTH_CONFIGURATION_REQUIRED']);
    const reasonCode = safeCodes.has(error?.message) ? error.message : 'ACTIVATION_CONFIGURATION_INVALID';
    oauth = undefined;
    delete service.ownerAuth;
    if(store?.close)await store.close().catch(()=>{});
    Object.assign(status, {status: 'ACTIVATION_BLOCKED', activation_stage: activationStage, reason_code: reasonCode, oauth_routes_enabled: false, owner_login_enabled: false, worker_running: false, reason: 'An initialized encrypted vault and complete authorization configuration are required. Database storage also requires TLS and an unexpired storage deadline; no fallback was created.'});
  }
  return service;
}
