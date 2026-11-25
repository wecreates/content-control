import crypto from 'node:crypto';
import {readCookie} from './owner-auth.mjs';

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const random = () => crypto.randomBytes(32).toString('base64url');
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const customerId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function authenticationCollections(data) {
  for (const key of ['customer_auth_pending', 'customer_sessions']) {
    if (data[key] !== undefined && (!data[key] || typeof data[key] !== 'object' || Array.isArray(data[key]))) {
      throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
    }
  }
}

function validPending(pending) {
  return Boolean(pending && typeof pending === 'object' && !Array.isArray(pending) &&
    /^[0-9a-f]{64}$/.test(pending.binding || '') && validToken(pending.verifier) &&
    Number.isSafeInteger(pending.expires_at) && pending.expires_at > 0);
}

function validSession(session) {
  return Boolean(session && typeof session === 'object' && !Array.isArray(session) &&
    customerId.test(session.customer_id || '') && Number.isSafeInteger(session.expires_at) && session.expires_at > 0);
}

export const CUSTOMER_COOKIE = '__Host-cyzor_customer';
export const CUSTOMER_LOGIN_COOKIE = '__Host-cyzor_customer_login';

export class CustomerAuthentication {
  constructor({store, registry, origin, clientId, clientSecret, fetchImpl = fetch, now = Date.now, shutdownSignal}) {
    let url;
    try { url = new URL(origin); } catch { throw Error('CUSTOMER_AUTH_CONFIGURATION_REQUIRED'); }
    if (url.protocol !== 'https:' || url.origin !== origin || !clientId || !clientSecret ||
        !store || typeof store.read !== 'function' || typeof store.update !== 'function' ||
        !registry || typeof registry.register !== 'function' || typeof registry.openRegisteredCustomer !== 'function') {
      throw Error('CUSTOMER_AUTH_CONFIGURATION_REQUIRED');
    }
    Object.assign(this, {store, registry, origin, clientId, clientSecret, fetchImpl, now, shutdownSignal});
    this.redirectUri = origin + '/api/social/customer/auth/callback';
  }

  active() {
    if (this.shutdownSignal?.aborted) throw Error('CUSTOMER_AUTH_UNAVAILABLE');
  }

  async begin() {
    this.active();
    const state = random(), binding = random(), verifier = random();
    await this.store.update(data => {
      this.active();
      authenticationCollections(data);
      data.customer_auth_pending ??= {};
      for (const [key, pending] of Object.entries(data.customer_auth_pending)) {
        if (!validPending(pending)) throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
        if (pending.expires_at <= this.now()) delete data.customer_auth_pending[key];
      }
      if (Object.keys(data.customer_auth_pending).length >= 100) throw Error('CUSTOMER_AUTH_CAPACITY');
      data.customer_auth_pending[digest(state)] = {
        binding:digest(binding),
        verifier,
        expires_at:this.now() + 600000,
      };
    });
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id:this.clientId,
      redirect_uri:this.redirectUri,
      state,
      scope:'read:user',
      code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method:'S256',
      allow_signup:'true',
    });
    return {url:url.href, binding};
  }

  async json(url, options) {
    this.active();
    try {
      const response = await this.fetchImpl(url, {
        ...options,
        redirect:'error',
        signal:AbortSignal.any([AbortSignal.timeout(20000), this.shutdownSignal].filter(Boolean)),
      });
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65536) throw Error();
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const data = JSON.parse(Buffer.concat(chunks).toString());
      this.active();
      if (!response.ok || data.error) throw Error();
      return data;
    } catch {
      throw Error('CUSTOMER_AUTH_FAILED');
    }
  }

  async complete({state, code, error}, binding) {
    this.active();
    if (!validToken(state) || !validToken(binding)) throw Error('CUSTOMER_AUTH_FAILED');
    const pending = await this.store.update(data => {
      authenticationCollections(data);
      const saved = data.customer_auth_pending?.[digest(state)];
      if (!validPending(saved) || saved.binding !== digest(binding) || saved.expires_at <= this.now()) {
        throw Error('CUSTOMER_AUTH_FAILED');
      }
      delete data.customer_auth_pending[digest(state)];
      return saved;
    });
    if (error || typeof code !== 'string' || !code || code.length > 4096) throw Error('CUSTOMER_AUTH_FAILED');
    const token = await this.json('https://github.com/login/oauth/access_token', {
      method:'POST',
      headers:{Accept:'application/json', 'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        client_id:this.clientId,
        client_secret:this.clientSecret,
        redirect_uri:this.redirectUri,
        code,
        code_verifier:pending.verifier,
      }).toString(),
    });
    if (typeof token.access_token !== 'string' || !token.access_token || token.token_type?.toLowerCase() !== 'bearer') {
      throw Error('CUSTOMER_AUTH_FAILED');
    }
    const user = await this.json('https://api.github.com/user', {
      headers:{Accept:'application/vnd.github+json', Authorization:`Bearer ${token.access_token}`, 'User-Agent':'CYZOR-Content-Control'},
    });
    if (!Number.isSafeInteger(user.id) || user.id <= 0) throw Error('CUSTOMER_AUTH_FAILED');
    const registered = await this.registry.register({
      provider:'github',
      subject:String(user.id),
      verified:true,
      verified_at:this.now(),
    });
    const session = random();
    this.active();
    await this.store.update(data => {
      this.active();
      authenticationCollections(data);
      data.customer_sessions ??= {};
      for (const [key, saved] of Object.entries(data.customer_sessions)) {
        if (!validSession(saved)) throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
        if (saved.expires_at <= this.now()) delete data.customer_sessions[key];
      }
      if (Object.keys(data.customer_sessions).length >= 1000) throw Error('CUSTOMER_AUTH_CAPACITY');
      if (Object.values(data.customer_sessions).filter(saved => saved.customer_id === registered.customer_id).length >= 10) {
        throw Error('CUSTOMER_AUTH_CAPACITY');
      }
      data.customer_sessions[digest(session)] = {
        customer_id:registered.customer_id,
        expires_at:this.now() + 28800000,
      };
    });
    return {session, created:registered.created};
  }

  async authorize(req) {
    this.active();
    const session = readCookie(req, CUSTOMER_COOKIE);
    if (!validToken(session)) return null;
    const data = await this.store.read();
    authenticationCollections(data);
    const saved = data.customer_sessions?.[digest(session)];
    if (saved === undefined) return null;
    if (!validSession(saved)) throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
    if (saved.expires_at <= this.now()) return null;
    const account = await this.registry.openRegisteredCustomer(saved.customer_id);
    return {customer_id:saved.customer_id, account};
  }

  async logout(req) {
    const session = readCookie(req, CUSTOMER_COOKIE);
    if (validToken(session)) {
      await this.store.update(data => {
        authenticationCollections(data);
        if (data.customer_sessions) delete data.customer_sessions[digest(session)];
      });
    }
  }
}
