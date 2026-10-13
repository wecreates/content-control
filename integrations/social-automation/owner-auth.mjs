import crypto from 'node:crypto';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const random = () => crypto.randomBytes(32).toString('base64url');
const valid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const OWNER_COOKIE = '__Host-cyzor_owner';
export const LOGIN_COOKIE = '__Host-cyzor_login';
export function readCookie(req, name) {
  const values = (req.headers.cookie || '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
  return values.length === 1 ? values[0].slice(name.length + 1) : null;
}
// GitHub verifies the configured numeric owner ID. Email and caller IDs are never credentials.
export class OwnerAuthentication {
  constructor({store, origin, clientId, clientSecret, ownerId, fetchImpl = fetch, now = Date.now, shutdownSignal}) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || !clientId || !clientSecret || !/^[1-9][0-9]*$/.test(ownerId || '')) throw Error('OWNER_CONFIGURATION_REQUIRED');
    Object.assign(this, {store, origin, clientId, clientSecret, ownerId, fetchImpl, now, shutdownSignal});
    this.redirectUri = origin + '/api/social/auth/callback';
  }
  active() { if (this.shutdownSignal?.aborted) throw Error('OWNER_AUTH_UNAVAILABLE'); }
  async begin() {
    this.active();
    const state = random(), binding = random(), verifier = random();
    await this.store.update(d => {
      this.active();
      d.owner_pending ??= {};
      for (const [key, p] of Object.entries(d.owner_pending)) if (p.expires_at <= this.now()) delete d.owner_pending[key];
      if (Object.keys(d.owner_pending).length >= 20) throw Error('OWNER_AUTH_CAPACITY');
      d.owner_pending[hash(state)] = {binding: hash(binding), verifier, expires_at: this.now() + 600000};
    });
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({client_id: this.clientId, redirect_uri: this.redirectUri, state, scope: 'read:user', code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', allow_signup: 'false'});
    return {url: url.href, binding};
  }
  async json(url, options) {
    this.active();
    try {
      const response = await this.fetchImpl(url, {...options, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(20000), this.shutdownSignal].filter(Boolean))});
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      try { for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 65536) throw Error(); chunks.push(value); } }
      finally { await reader.cancel().catch(() => {}); }
      const data = JSON.parse(Buffer.concat(chunks).toString());
      this.active();
      if (!response.ok || data.error) throw Error();
      return data;
    } catch { throw Error('OWNER_AUTH_FAILED'); }
  }
  async complete({state, code, error}, binding) {
    this.active();
    if (!valid(state) || !valid(binding)) throw Error('OWNER_AUTH_FAILED');
    const pending = await this.store.update(d => {
      const p = d.owner_pending?.[hash(state)];
      if (!p || p.binding !== hash(binding) || p.expires_at <= this.now()) throw Error('OWNER_AUTH_FAILED');
      delete d.owner_pending[hash(state)]; return p;
    });
    if (error || typeof code !== 'string' || !code || code.length > 4096) throw Error('OWNER_AUTH_FAILED');
    const token = await this.json('https://github.com/login/oauth/access_token', {method: 'POST', headers: {Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: this.redirectUri, code, code_verifier: pending.verifier}).toString()});
    if (typeof token.access_token !== 'string' || !token.access_token || token.token_type?.toLowerCase() !== 'bearer') throw Error('OWNER_AUTH_FAILED');
    const user = await this.json('https://api.github.com/user', {headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'CYZOR-Content-Control'}});
    if (!Number.isSafeInteger(user.id) || String(user.id) !== this.ownerId) throw Error('OWNER_AUTH_FAILED');
    const session = random();
    this.active();
    await this.store.update(d => {
      this.active();
      d.owner_sessions ??= {};
      for (const [key, s] of Object.entries(d.owner_sessions)) if (s.expires_at <= this.now()) delete d.owner_sessions[key];
      if (Object.keys(d.owner_sessions).length >= 10) throw Error('OWNER_AUTH_CAPACITY');
      d.owner_sessions[hash(session)] = {owner: this.ownerId, expires_at: this.now() + 28800000};
    });
    return session;
  }
  async authorize(req) {
    this.active();
    const session = readCookie(req, OWNER_COOKIE);
    if (!valid(session)) return null;
    const saved = (await this.store.read()).owner_sessions?.[hash(session)];
    return saved?.owner === this.ownerId && saved.expires_at > this.now() ? 'github:' + this.ownerId : null;
  }
  async logout(req) {
    const session = readCookie(req, OWNER_COOKIE);
    if (valid(session)) await this.store.update(d => { if (d.owner_sessions) delete d.owner_sessions[hash(session)]; });
  }
}
