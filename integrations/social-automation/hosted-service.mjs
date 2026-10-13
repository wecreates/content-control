import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {EncryptedSocialStore, SocialAutomation, socialRuntimeReadiness} from '../../social-automation.js';
import {createProviderAdapters,providerReadiness} from './providers.mjs';
import {SocialReadWorker} from './worker.mjs';
import {SocialOAuthCoordinator} from './oauth-coordinator.mjs';
import {createYouTubeOAuth} from './google-oauth.mjs';
import {createInstagramOAuth} from './meta-oauth.mjs';
import {OwnerAuthentication} from './owner-auth.mjs';
import {createPostgresStore,initializePostgresVault} from './postgres-store.mjs';

// No paid provisioning, fallback storage or public import. Database initialization requires explicit operator opt-in.
// Operator configuration is NOT independent proof of durable storage.
export async function initializeSocialService({env = process.env, fetchImpl = fetch, root = process.cwd(), authorizeOwner, postgresStoreFactory = createPostgresStore, initializeVault = initializePostgresVault, now = Date.now} = {}) {
  let worker,oauth,store;
  let activationStage = 'policy';
  let storageReadAt = null;
  const expiry = Date.parse(env.SOCIAL_STORAGE_EXPIRES_AT);
  const normalizedExpiry = Number.isFinite(expiry) ? new Date(expiry).toISOString() : null;
  const shutdown = new AbortController();
  const status = {...socialRuntimeReadiness(env), configured_storage_mode: 'unconfigured', providers:providerReadiness()};
  // Configuration names are safe to report; values and account identifiers never leave the vault.
  const configurationGroups = {
    owner: ['SOCIAL_PUBLIC_ORIGIN','OWNER_GITHUB_CLIENT_ID','OWNER_GITHUB_CLIENT_SECRET','OWNER_GITHUB_ID'],
    youtube: ['YOUTUBE_OAUTH_CLIENT_ID','YOUTUBE_OAUTH_CLIENT_SECRET','YOUTUBE_OAUTH_REDIRECT_URI','YOUTUBE_CHANNEL_ID'],
    instagram: ['META_APP_ID','META_APP_SECRET','INSTAGRAM_OAUTH_REDIRECT_URI','INSTAGRAM_ACCOUNT_ID'],
  };
  status.authorization_configuration = Object.fromEntries(Object.entries(configurationGroups).map(([name, keys]) => {
    const missing = keys.filter(key => !env[key]);
    return [name, {status: missing.length ? 'INCOMPLETE' : 'PRESENT_UNVERIFIED', missing_configuration: missing, live_verified: false}];
  }));
  const service = {
    status: () => {
      const current = now();
      const postgres = env.SOCIAL_STORAGE_MODE === 'postgres_encrypted';
      const expired = postgres && Number.isFinite(expiry) && expiry <= current;
      const cutoff = postgres && Number.isFinite(expiry) && expiry - current <= 86400000;
      const storageFailed = status.status === 'ACTIVATION_BLOCKED' && ['policy','storage_configuration','storage_bootstrap','storage_read','storage_probe'].includes(status.activation_stage);
      const healthStatus = shutdown.signal.aborted ? 'STOPPED' : storageFailed ? 'BLOCKED' : postgres && !Number.isFinite(expiry) ? 'CONFIGURATION_REQUIRED' : expired ? 'EXPIRED' : cutoff ? 'EXPIRING' : storageReadAt !== null ? 'STARTUP_OBSERVATION_ONLY' : 'NOT_VERIFIED';
      return {...status, storage_bootstrap:{...status.storage_bootstrap}, storage_expires_at:normalizedExpiry,
        storage_health:{status:healthStatus, live_database_checked:false, availability_verified:false,
          last_read_verified_at:storageReadAt === null ? null : new Date(storageReadAt).toISOString(),
          observation_age_ms:storageReadAt === null ? null : Math.max(0,current-storageReadAt),
          operations_blocked:shutdown.signal.aborted || storageFailed || storageReadAt === null || cutoff || (postgres && !Number.isFinite(expiry)),
          reason_code:storageFailed ? status.reason_code : expired || cutoff ? 'STORAGE_EXPIRING' : postgres && !Number.isFinite(expiry) ? 'STORAGE_EXPIRY_REQUIRED' : null,
          scope:'Storage policy and recorded startup failures; operations_blocked=false does not verify live availability; no database polling',publication_enabled:false},
        ...(worker ? {worker_running: worker.active, last_cycle: worker.status()} : {})};
    },
    beginAuthorization:async(platform,context)=>{if(shutdown.signal.aborted)throw Error('OAUTH_STOPPED');if(!oauth)throw Error('OAUTH_NOT_CONFIGURED');return oauth.begin(platform,context);},
    completeAuthorization:async(platform,callback,context)=>{if(shutdown.signal.aborted)throw Error('OAUTH_STOPPED');if(!oauth)throw Error('OAUTH_NOT_CONFIGURED');return oauth.complete(platform,callback,context);},
    stop: async () => {shutdown.abort(); if (worker) await worker.stop(); if(store?.close)await store.close();},
  };
  const bootstrapRequested = env.SOCIAL_STORAGE_INITIALIZE === 'true';
  const checkRequested = !bootstrapRequested && env.SOCIAL_STORAGE_CHECK_ENABLED === 'true';
  const storageRequested = bootstrapRequested || checkRequested;
  const runtimeBootId = crypto.randomUUID();
  status.storage_bootstrap = {status:'NOT_REQUESTED',read_verified:false,durable_storage_verified:false};
  if (!storageRequested && env.SOCIAL_WORKER_ENABLED !== 'true' && env.SOCIAL_OAUTH_ENABLED !== 'true') return service;
  try {
    if (env.PUBLICATION_ENABLED && env.PUBLICATION_ENABLED !== 'false') throw Error('PUBLICATION_POLICY_BLOCKED');
    activationStage = 'storage_configuration';
    if(env.SOCIAL_STORAGE_MODE === 'postgres_encrypted') {
      store=postgresStoreFactory(env);
      if(bootstrapRequested) {
        activationStage = 'storage_bootstrap';
        status.storage_bootstrap = {status:'RUNNING',read_verified:false,durable_storage_verified:false};
        await initializeVault(store);
      }
    } else {
    if (storageRequested) throw Error('PRIVATE_STORE_CONFIGURATION_REQUIRED');
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
    storageReadAt = now();
    if(storageRequested) {
      activationStage = 'storage_probe';
      const validProbe = probe => probe && typeof probe === 'object' &&
        typeof probe.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(probe.id) &&
        typeof probe.created_at === 'string' && Number.isFinite(Date.parse(probe.created_at));
      const expected = bootstrapRequested ? await store.update(data => {
        if (!Object.hasOwn(data,'storage_probe')) data.storage_probe = {id:crypto.randomUUID(),created_at:new Date().toISOString()};
        if (!validProbe(data.storage_probe)) throw Error('PRIVATE_STORE_INTEGRITY_FAILED');
        return {id:data.storage_probe.id,created_at:data.storage_probe.created_at};
      }) : saved.storage_probe;
      if (!validProbe(expected)) throw Error('PRIVATE_STORE_INTEGRITY_FAILED');
      const observed = bootstrapRequested ? (await store.read()).storage_probe : saved.storage_probe;
      if (!validProbe(observed) || observed.id !== expected.id || observed.created_at !== expected.created_at) throw Error('PRIVATE_STORE_INTEGRITY_FAILED');
      storageReadAt = now();
      status.storage_bootstrap = {checked_at:new Date(storageReadAt).toISOString(),status:bootstrapRequested?'INITIALIZED_READ_VERIFIED':'EXISTING_READ_VERIFIED',read_verified:true,write_read_verified:bootstrapRequested,probe_id:expected.id,runtime_boot_id:runtimeBootId,durable_storage_verified:false,scope:bootstrapRequested?'Encrypted probe write and separate read verified; restart persistence requires independent comparison':'Existing encrypted vault and probe read only; restart persistence requires independent comparison'};
      status.configured_storage_mode = env.SOCIAL_STORAGE_MODE;
      if(env.SOCIAL_WORKER_ENABLED !== 'true' && env.SOCIAL_OAUTH_ENABLED !== 'true') {
        await store.close();store=undefined;
        status.reason = bootstrapRequested ? 'Storage initialization and read verified; OAuth and worker remain disabled.' : 'Existing storage read verified; OAuth and worker remain disabled.';
        return service;
      }
    }
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
    const safeCodes = new Set(['PUBLICATION_POLICY_BLOCKED', 'PRIVATE_STORE_CONFIGURATION_REQUIRED', 'STORAGE_EXPIRY_REQUIRED', 'STORAGE_EXPIRING', 'PRIVATE_STORE_UNAVAILABLE', 'PRIVATE_STORE_NOT_INITIALIZED', 'PRIVATE_STORE_INTEGRITY_FAILED', 'PRIVATE_STORE_INITIALIZATION_FAILED', 'OWNER_CONFIGURATION_REQUIRED', 'OAUTH_CONFIGURATION_REQUIRED']);
    const reasonCode = safeCodes.has(error?.message) ? error.message : 'ACTIVATION_CONFIGURATION_INVALID';
    if(storageRequested && !status.storage_bootstrap.read_verified)status.storage_bootstrap = {status:'BLOCKED',read_verified:false,durable_storage_verified:false,reason_code:reasonCode};
    oauth = undefined;
    delete service.ownerAuth;
    if(store?.close)await store.close().catch(()=>{});
    Object.assign(status, {status: 'ACTIVATION_BLOCKED', activation_stage: activationStage, reason_code: reasonCode, oauth_routes_enabled: false, owner_login_enabled: false, worker_running: false, reason: 'An initialized encrypted vault and complete authorization configuration are required. Database storage also requires TLS and an unexpired storage deadline; no fallback was created.'});
  }
  return service;
}
