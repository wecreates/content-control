import crypto from 'node:crypto';

const CUSTOMER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const IDENTITY_PROVIDERS = new Set(['github']);

function validateIdentity(identity, now, maxIdentityAgeMs) {
  if (!identity || identity.verified !== true || !IDENTITY_PROVIDERS.has(identity.provider) ||
      typeof identity.subject !== 'string' || !/^[1-9][0-9]{0,19}$/.test(identity.subject) ||
      !Number.isSafeInteger(identity.verified_at) || identity.verified_at <= 0 ||
      identity.verified_at > now || now - identity.verified_at > maxIdentityAgeMs) {
    throw Error('CUSTOMER_IDENTITY_REQUIRED');
  }
}

function identityHash(pepper, identity) {
  return crypto.createHmac('sha256', pepper)
    .update(identity.provider).update('\0').update(identity.subject).digest('hex');
}

function validateCustomerRecord(record, expected = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.schema_version !== 1 ||
      !CUSTOMER_ID.test(record.id || '') || !IDENTITY_PROVIDERS.has(record.identity_provider) ||
      !/^[0-9a-f]{64}$/.test(record.identity_hash || '') ||
      !Number.isSafeInteger(record.created_at) || record.created_at <= 0 ||
      !record.connections || typeof record.connections !== 'object' || Array.isArray(record.connections) ||
      !Array.isArray(record.jobs) ||
      (expected.id && record.id !== expected.id) ||
      (expected.identity_hash && record.identity_hash !== expected.identity_hash)) {
    throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
  }
}

function customerCollections(state) {
  state.customer_accounts ??= {};
  state.customer_identity_index ??= {};
  if (!state.customer_accounts || typeof state.customer_accounts !== 'object' || Array.isArray(state.customer_accounts) ||
      !state.customer_identity_index || typeof state.customer_identity_index !== 'object' || Array.isArray(state.customer_identity_index)) {
    throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
  }
}

class CustomerScopedStore {
  constructor({store, customerId, expectedIdentityHash}) {
    Object.assign(this, {store, customerId, expectedIdentityHash});
  }

  async read() {
    const state = await this.store.read();
    const record = state.customer_accounts?.[this.customerId];
    validateCustomerRecord(record, {id:this.customerId, identity_hash:this.expectedIdentityHash});
    return structuredClone(record);
  }

  async update(mutator) {
    if (typeof mutator !== 'function') throw Error('CUSTOMER_MUTATOR_REQUIRED');
    return this.store.update(async state => {
      customerCollections(state);
      const record = state.customer_accounts[this.customerId];
      validateCustomerRecord(record, {id:this.customerId, identity_hash:this.expectedIdentityHash});
      const immutable = {
        id: record.id,
        identity_provider: record.identity_provider,
        identity_hash: record.identity_hash,
        created_at: record.created_at,
      };
      const result = await mutator(record);
      validateCustomerRecord(record, {id:this.customerId, identity_hash:this.expectedIdentityHash});
      for (const [key, value] of Object.entries(immutable)) {
        if (record[key] !== value) throw Error('CUSTOMER_SCOPE_VIOLATION');
      }
      return result;
    });
  }
}

// This registry accepts only a freshly verified identity from an authentication
// boundary. It does not itself perform GitHub OAuth or expose a public route.
export class CustomerAccountRegistry {
  constructor({store, identityPepper, now = Date.now, maxCustomers = 1000, maxIdentityAgeMs = 300000}) {
    if (!store || typeof store.read !== 'function' || typeof store.update !== 'function' ||
        typeof identityPepper !== 'string' || Buffer.byteLength(identityPepper) < 32 ||
        !Number.isSafeInteger(maxCustomers) || maxCustomers < 1 || maxCustomers > 10000 ||
        !Number.isSafeInteger(maxIdentityAgeMs) || maxIdentityAgeMs < 1 || maxIdentityAgeMs > 900000) {
      throw Error('CUSTOMER_REGISTRY_CONFIGURATION_REQUIRED');
    }
    Object.assign(this, {store, identityPepper, now, maxCustomers, maxIdentityAgeMs});
  }

  verify(identity) {
    const observedAt = this.now();
    validateIdentity(identity, observedAt, this.maxIdentityAgeMs);
    return {observedAt, hash:identityHash(this.identityPepper, identity)};
  }

  async register(identity) {
    const {observedAt, hash} = this.verify(identity);
    return this.store.update(state => {
      customerCollections(state);
      const indexedId = state.customer_identity_index[hash];
      if (indexedId !== undefined) {
        const record = state.customer_accounts[indexedId];
        validateCustomerRecord(record, {id:indexedId, identity_hash:hash});
        return {customer_id:indexedId, created:false, created_at:record.created_at};
      }
      if (Object.keys(state.customer_accounts).length >= this.maxCustomers) throw Error('CUSTOMER_CAPACITY_REACHED');
      const customerId = crypto.randomUUID();
      state.customer_accounts[customerId] = {
        schema_version:1,
        id:customerId,
        identity_provider:identity.provider,
        identity_hash:hash,
        created_at:observedAt,
        connections:{},
        jobs:[],
      };
      state.customer_identity_index[hash] = customerId;
      return {customer_id:customerId, created:true, created_at:observedAt};
    });
  }

  async open(identity) {
    const {hash} = this.verify(identity);
    const state = await this.store.read();
    const customerId = state.customer_identity_index?.[hash];
    if (!CUSTOMER_ID.test(customerId || '')) throw Error('CUSTOMER_NOT_REGISTERED');
    validateCustomerRecord(state.customer_accounts?.[customerId], {id:customerId, identity_hash:hash});
    return new CustomerScopedStore({store:this.store, customerId, expectedIdentityHash:hash});
  }

  // CustomerAuthentication calls this only after validating an opaque, hashed
  // browser session. The reverse-index check prevents a corrupt or remapped
  // session record from crossing customer scopes.
  async openRegisteredCustomer(customerId) {
    if (!CUSTOMER_ID.test(customerId || '')) throw Error('CUSTOMER_SESSION_INVALID');
    const state = await this.store.read();
    const record = state.customer_accounts?.[customerId];
    validateCustomerRecord(record, {id:customerId});
    if (state.customer_identity_index?.[record.identity_hash] !== customerId) {
      throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
    }
    return new CustomerScopedStore({store:this.store, customerId, expectedIdentityHash:record.identity_hash});
  }

  // Internal worker enumeration. IDs never leave the service and every record
  // plus reverse index is validated before the bounded worker opens a scope.
  async listRegisteredCustomerIds() {
    const state = await this.store.read();
    customerCollections(state);
    const ids = Object.keys(state.customer_accounts).sort();
    if (ids.length > this.maxCustomers) throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
    for (const id of ids) {
      const record = state.customer_accounts[id];
      validateCustomerRecord(record, {id});
      if (state.customer_identity_index[record.identity_hash] !== id) throw Error('CUSTOMER_STORE_INTEGRITY_FAILED');
    }
    return ids;
  }
}
