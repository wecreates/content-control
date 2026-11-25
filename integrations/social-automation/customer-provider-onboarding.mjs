import crypto from 'node:crypto';
import {SocialAutomation} from '../../social-automation.js';
import {SocialOAuthCoordinator} from './oauth-coordinator.mjs';

const safePlatform = value => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(value);
const jobState = value => ({queued:'QUEUED', retry:'RETRY_PENDING', blocked:'BLOCKED', completed:'COMPLETED'})[value] || 'NOT_QUEUED';

// Hosts inject only explicitly configured read-only providers and adapters. The
// authenticated customer account is the sole namespace used for OAuth, grants
// and first-read jobs.
export class CustomerProviderOnboarding {
  constructor({customerAuth, registry, providers = {}, adapters = {}, now = Date.now, shutdownSignal}) {
    if (!customerAuth || typeof customerAuth.authorize !== 'function' ||
        !registry || typeof registry.openRegisteredCustomer !== 'function' || typeof registry.listRegisteredCustomerIds !== 'function' ||
        !providers || typeof providers !== 'object' || Array.isArray(providers) ||
        !adapters || typeof adapters !== 'object' || Array.isArray(adapters)) {
      throw Error('CUSTOMER_ONBOARDING_CONFIGURATION_REQUIRED');
    }
    for (const platform of Object.keys(providers)) {
      if (!safePlatform(platform) || !providers[platform]?.authorizationUrl ||
          !providers[platform]?.exchange || !adapters[platform]?.verify ||
          !adapters[platform]?.read_profile) {
        throw Error('CUSTOMER_ONBOARDING_CONFIGURATION_REQUIRED');
      }
    }
    Object.assign(this, {customerAuth, registry, providers, adapters, now, shutdownSignal});
    this.workerCursor = 0;
  }

  active() {
    if (this.shutdownSignal?.aborted) throw Error('CUSTOMER_ONBOARDING_UNAVAILABLE');
  }

  async scoped(context) {
    this.active();
    const authorized = await this.customerAuth.authorize(context);
    this.active();
    if (!authorized?.customer_id || !authorized.account) throw Error('CUSTOMER_AUTH_REQUIRED');
    const expectedCustomer = authorized.customer_id;
    const runtime = new SocialAutomation({store:authorized.account, adapters:this.adapters, now:this.now});
    const coordinator = new SocialOAuthCoordinator({
      store:authorized.account,
      runtime,
      providers:this.providers,
      now:this.now,
      shutdownSignal:this.shutdownSignal,
      authorizeOwner:async request => {
        this.active();
        const current = await this.customerAuth.authorize(request);
        this.active();
        if (current?.customer_id !== expectedCustomer) throw Error('CUSTOMER_AUTH_REQUIRED');
        return expectedCustomer;
      },
    });
    return {authorized, runtime, coordinator};
  }

  async begin(platform, context) {
    if (!safePlatform(platform) || !this.providers[platform]) throw Error('OAUTH_PROVIDER_NOT_CONFIGURED');
    const {coordinator} = await this.scoped(context);
    return coordinator.begin(platform, context);
  }

  async complete(platform, callback, context) {
    if (!safePlatform(platform) || !this.providers[platform]) throw Error('OAUTH_PROVIDER_NOT_CONFIGURED');
    const {authorized, runtime, coordinator} = await this.scoped(context);
    await coordinator.complete(platform, callback, context);
    this.active();
    const queued = await this.ensureFirstRead(authorized.customer_id, runtime, platform);
    return {platform, connection_status:'VERIFIED', first_read_job_status:jobState(queued.status),
      publication_enabled:false, external_writes_enabled:false};
  }

  async ensureFirstRead(customerId, runtime, platform) {
    const state = await runtime.store.read();
    const connection = state.connections?.[platform];
    if (!connection || typeof connection.generation !== 'string' || !connection.generation ||
        typeof connection.account_id !== 'string' || !connection.account_id) {
      throw Error('CUSTOMER_CONNECTION_NOT_RETAINED');
    }
    const identity = crypto.createHash('sha256')
      .update(customerId).update('\0').update(platform).update('\0').update(connection.generation)
      .digest('hex');
    return runtime.enqueue({
      id:`first-read-${identity.slice(0, 40)}`,
      platform,
      operation:'read_profile',
      payload:{},
    }, {expectedGrant:{account_id:connection.account_id, generation:connection.generation}});
  }

  // Called by a bounded internal worker. Browser input cannot select an
  // operation or payload, so the first job remains fixed and read-only.
  async runOnce(context) {
    const {authorized, runtime} = await this.scoped(context);
    for (const platform of Object.keys(this.providers)) {
      const state = await runtime.store.read();
      if (state.connections?.[platform]) await this.ensureFirstRead(authorized.customer_id, runtime, platform);
    }
    await runtime.tick();
    return this.status(context);
  }

  // Bounded unattended worker cycle. Each cycle advances at most ten customer
  // namespaces and carries a rotating cursor so one account cannot starve later
  // accounts. A broken tenant is isolated to its own result.
  async runDue({limit = 10} = {}) {
    this.active();
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('INVALID_CUSTOMER_WORKER_LIMIT');
    const ids = await this.registry.listRegisteredCustomerIds();
    if (!ids.length) return {processed:0, failed:0, publication_enabled:false, external_writes_enabled:false};
    const count = Math.min(limit, ids.length);
    const selected = Array.from({length:count}, (_, index) => ids[(this.workerCursor + index) % ids.length]);
    this.workerCursor = (this.workerCursor + count) % ids.length;
    let processed = 0, failed = 0;
    for (const customerId of selected) {
      try {
        const account = await this.registry.openRegisteredCustomer(customerId);
        const runtime = new SocialAutomation({store:account, adapters:this.adapters, now:this.now});
        const state = await account.read();
        for (const platform of Object.keys(this.providers)) {
          if (state.connections?.[platform]) await this.ensureFirstRead(customerId, runtime, platform);
        }
        await runtime.tick();
        processed++;
      } catch { failed++; }
    }
    return {processed, failed, publication_enabled:false, external_writes_enabled:false};
  }

  async status(context) {
    const {runtime} = await this.scoped(context);
    const observed = await runtime.status();
    const providers = Object.keys(this.providers).sort().map(platform => {
      const connection = observed.connections.find(item => item.platform === platform);
      const jobs = observed.jobs.filter(item => item.platform === platform && item.operation === 'read_profile');
      const latest = jobs.at(-1);
      return {
        platform,
        status:connection ? (connection.status === 'connected' ? 'VERIFIED' : 'REAUTHORIZATION_REQUIRED') : 'CONNECTION_REQUIRED',
        first_read_job_status:jobState(latest?.status),
        attempts:Number.isSafeInteger(latest?.attempts) ? latest.attempts : 0,
        ...(latest?.reason ? {reason:latest.reason} : {}),
      };
    });
    return {providers, publication_enabled:false, external_writes_enabled:false};
  }
}
