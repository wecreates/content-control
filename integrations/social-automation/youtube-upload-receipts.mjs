// Contract fixture only. No production persistence is installed by this module.
// A future private store must durably commit put() BEFORE resolving it, serialize
// withExclusive() across ALL processes, and retain uncertain states after crashes.
export class InMemoryUploadReceiptStore {
  constructor() { this.records = new Map(); this.locks = new Map(); }
  async withExclusive(key, fn) {
    const previous = this.locks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    this.locks.set(key, gate);
    await previous;
    try { return await fn(); }
    finally { release(); if (this.locks.get(key) === gate) this.locks.delete(key); }
  }
  async get(key) { return structuredClone(this.records.get(key)); }
  async put(key, record) { this.records.set(key, structuredClone(record)); }
}
