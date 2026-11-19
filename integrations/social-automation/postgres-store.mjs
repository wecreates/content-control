import {parseStorageRetention} from './storage-retention.mjs';
import {parseVaultKey} from './vault-key.mjs';
import crypto from 'node:crypto';
import pg from 'pg';
const TABLE = 'cyzor_social_vault';
const ID = 'owner';
// Dedicated encrypted row. No provider credentials, sessions or media are stored as plaintext SQL fields.
export class PostgresSocialStore {
  constructor({pool, key, expiresAt, retentionPolicy, now = Date.now}) {
    if (!pool) throw Error('PRIVATE_STORE_CONFIGURATION_REQUIRED');
    const retention = parseStorageRetention({retentionPolicy, expiresAt});
    Object.assign(this, {pool, key: parseVaultKey(key), ...retention, now});
    this.serial = Promise.resolve(); this.closed = false;
  }
  active() {
    if (this.closed) throw Error('PRIVATE_STORE_UNAVAILABLE');
    // Stop accepting authorization before a free database reaches its deletion deadline.
    if (this.retentionPolicy === 'fixed_expiry' && this.expiry - this.now() <= 86400000) throw Error('STORAGE_EXPIRING');
  }
  seal(data) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from('cyzor-social-v1'));
    const encoded = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
    if (encoded.length > 16 * 1024 * 1024) throw Error('PRIVATE_STORE_CAPACITY');
    return {version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encoded.toString('base64')};
  }
  open(envelope) {
    try {
      if (envelope.version !== 1) throw Error();
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(Buffer.from('cyzor-social-v1')); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const data = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString());
      if (data.version !== 1 || !data.connections || Array.isArray(data.connections) || typeof data.connections !== 'object' || !Array.isArray(data.jobs)) throw Error();
      return data;
    } catch {throw Error('PRIVATE_STORE_INTEGRITY_FAILED');}
  }
  async read() {
    this.active();
    let result;
    try {result = await this.pool.query(`SELECT envelope FROM ${TABLE} WHERE id=$1`, [ID]);}
    catch {throw Error('PRIVATE_STORE_UNAVAILABLE');}
    if (result.rows.length !== 1) throw Error('PRIVATE_STORE_NOT_INITIALIZED');
    return this.open(result.rows[0].envelope);
  }
  update(fn) {
    const run = this.serial.catch(() => {}).then(async() => {
      this.active();
      let client;
      try {client = await this.pool.connect();} catch {throw Error('PRIVATE_STORE_UNAVAILABLE');}
      let committed = false, discard = false;
      const query = async (...args) => {
        try {return await client.query(...args);}
        catch(error) {throw Error(error?.code === '55P03' ? 'PRIVATE_STORE_BUSY' : 'PRIVATE_STORE_UNAVAILABLE');}
      };
      try {
        await query('BEGIN');
        await query("SET LOCAL lock_timeout='2s'");
        await query("SET LOCAL statement_timeout='15s'");
        const result = await query(`SELECT envelope FROM ${TABLE} WHERE id=$1 FOR UPDATE`, [ID]);
        if (result.rows.length !== 1) throw Error('PRIVATE_STORE_NOT_INITIALIZED');
        const data = this.open(result.rows[0].envelope);
        const value = await fn(data);
        this.active();
        await query(`UPDATE ${TABLE} SET envelope=$1, updated_at=now() WHERE id=$2`, [this.seal(data), ID]);
        await query('COMMIT'); committed = true;
        return value;
      } finally {
        if (!committed) try {await client.query('ROLLBACK');} catch {discard = true;}
        client.release(discard);
      }
    });
    this.serial = run; return run;
  }
  async close() {this.closed = true; await this.serial.catch(() => {}); await this.pool.end();}
}
export function postgresPoolOptions(connectionString) {
  let url, fields;
  try {
    url = new URL(connectionString);
    fields = {host: url.hostname, port: Number(url.port || 5432), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1))};
  } catch {throw Error('PRIVATE_STORE_CONFIGURATION_REQUIRED');}
  // Explicit fields prevent driver connection-string options from replacing verified TLS.
  const keys = [...url.searchParams.keys()];
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !fields.host || !fields.user || !fields.password || !fields.database || url.hash || keys.some(k => !['sslmode', 'channel_binding'].includes(k)) || new Set(keys).size !== keys.length || url.searchParams.has('sslmode') && !['require', 'verify-full'].includes(url.searchParams.get('sslmode'))) throw Error('PRIVATE_STORE_CONFIGURATION_REQUIRED');
  if (url.searchParams.has('channel_binding')) {
    if (!['require', 'prefer', 'disable'].includes(url.searchParams.get('channel_binding'))) throw Error('PRIVATE_STORE_CONFIGURATION_REQUIRED');
    // pg 8.23.1 enableChannelBinding is opportunistic, not enforcement of "require".
    // Do not silently drop or downgrade an explicitly requested security option.
    throw Error('PRIVATE_STORE_CHANNEL_BINDING_UNSUPPORTED');
  }
  return {...fields, ssl: {rejectUnauthorized: true}, max: 2, connectionTimeoutMillis: 10000, query_timeout: 20000, idleTimeoutMillis: 10000, application_name: 'cyzor-social-read-only'};
}
export function createPostgresStore(env) {
  // Validate policy and key before constructing a driver pool.
  const retentionPolicy = env.SOCIAL_STORAGE_RETENTION_POLICY, expiresAt = env.SOCIAL_STORAGE_EXPIRES_AT;
  parseStorageRetention({retentionPolicy, expiresAt});
  parseVaultKey(env.SOCIAL_VAULT_KEY);
  const pool = new pg.Pool(postgresPoolOptions(env.SOCIAL_DATABASE_URL));
  pool.on('error', () => {}); // Request paths report sanitized availability; never log connection strings.
  try {return new PostgresSocialStore({pool, key: env.SOCIAL_VAULT_KEY, expiresAt, retentionPolicy});}
  catch (error) {void pool.end(); throw error;}
}
// Explicit operator initialization only; hosted startup calls this solely with SOCIAL_STORAGE_INITIALIZE=true.
export async function initializePostgresVault(store) {
  store.active();
  let client;
  try {client = await store.pool.connect();} catch {throw Error('PRIVATE_STORE_INITIALIZATION_FAILED');}
  let committed = false, discard = false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='2s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    await client.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (id text PRIMARY KEY CHECK (id='owner'), envelope jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`INSERT INTO ${TABLE} (id,envelope) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [ID, store.seal({version: 1, connections: {}, jobs: []})]);
    const found = await client.query(`SELECT envelope FROM ${TABLE} WHERE id=$1`, [ID]);
    if(found.rows.length !== 1) throw Error('PRIVATE_STORE_NOT_INITIALIZED');
    store.open(found.rows[0].envelope); // Wrong key must fail even on repeated initialization.
    store.active(); // Expiry or shutdown during initialization cannot commit a replacement vault.
    await client.query('COMMIT'); committed = true;
  } catch {throw Error('PRIVATE_STORE_INITIALIZATION_FAILED');}
  finally {
    if(!committed) try {await client.query('ROLLBACK');} catch {discard = true;}
    client.release(discard);
  }
}
