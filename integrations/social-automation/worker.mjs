import crypto from 'node:crypto';
// Private worker, not an HTTP endpoint. One cycle has at most one new read per
// connected provider. Calls and results go through the existing encrypted queue.
export class SocialReadWorker {
  constructor({runtime, now = () => Date.now(), intervalMs = 6 * 60 * 60 * 1000, setTimer = setTimeout, clearTimer = clearTimeout}) {
    if (!Number.isFinite(intervalMs) || intervalMs < 60000) throw Error('INVALID_WORKER_INTERVAL');
    this.runtime = runtime; this.now = now; this.intervalMs = intervalMs;
    this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.active = false; this.inflight = null; this.timer = null;
    this.last = {status: 'NOT_STARTED', last_completed_at: null};
  }
  cycle() {
    if (this.inflight) return this.inflight;
    this.inflight = this.run().finally(() => {this.inflight = null;});
    return this.inflight;
  }
  async run() {
    try {
      const state = await this.runtime.store.read();
      let capacityBlocked = false;
      for (const [platform, grant] of Object.entries(state.connections)) {
        const adapter = this.runtime.adapters[platform];
        const operation = typeof adapter?.read_media === "function" ? "read_media" : "read_profile";
        if (adapter?.blocked_reason) continue;
        if (grant.status !== 'connected' || !Number.isFinite(grant.expires_at) || (grant.expires_at <= this.now() && typeof adapter?.refresh !== 'function') || typeof adapter?.[operation] !== 'function') continue;
        if (state.jobs.some(j => j.platform === platform && j.operation === operation && ['queued', 'retry'].includes(j.status))) continue;
        const account = crypto.createHash('sha256').update(grant.account_id).digest('hex').slice(0, 16);
        // A newly verified grant may recover within the same polling bucket,
        // without resetting old failure history or retry counters.
        const generation = crypto.createHash('sha256').update(String(grant.verified_at ?? 'legacy')).digest('hex').slice(0, 12);
        try {
          await this.runtime.enqueue({id: `poll_${platform}_${account}_${generation}_${Math.floor(this.now() / this.intervalMs)}`, platform, operation});
        } catch (error) {
          if (error?.message !== 'QUEUE_CAPACITY_REACHED') throw error;
          capacityBlocked = true;
        }
      }
      const result = await this.runtime.tick();
      const current = await this.runtime.store.read();
      // Queue counts include history. Health uses outstanding work plus the latest
      // result for each current account/operation, so recovery clears old failures.
      const latest = new Map();
      for (const job of current.jobs) {
        const grant = current.connections[job.platform];
        if (grant && job.account_id !== grant.account_id) continue;
        latest.set(`${job.platform}:${job.operation}`, job);
      }
      const currentCounts = {};
      for (const job of latest.values()) currentCounts[job.status] = (currentCounts[job.status] || 0) + 1;
      const pending = current.jobs.filter(j => ['queued','retry'].includes(j.status));
      const connectionBlocked = Object.entries(current.connections).some(([platform, grant]) => {
        const adapter = this.runtime.adapters[platform];
        return grant.status !== 'connected' || !Number.isFinite(grant.expires_at) ||
          (grant.expires_at <= this.now() && typeof adapter?.refresh !== 'function') ||
          !adapter || adapter.blocked_reason ||
          (typeof adapter.read_media !== 'function' && typeof adapter.read_profile !== 'function');
      });
      const blocked = capacityBlocked || connectionBlocked || currentCounts.blocked > 0;
      const retry = pending.some(j => j.status === 'retry');
      const status = blocked ? 'CYCLE_BLOCKED' : retry ? 'CYCLE_RETRY_PENDING' : pending.length ? 'CYCLE_WORK_PENDING' : latest.size ? 'CYCLE_COMPLETED' : 'CYCLE_IDLE';
      const reason = capacityBlocked ? 'QUEUE_CAPACITY_REACHED' : connectionBlocked ? 'CONNECTION_UNAVAILABLE' : currentCounts.blocked > 0 ? 'JOBS_BLOCKED' : retry ? 'PROVIDER_RETRY_PENDING' : pending.length ? 'JOBS_PENDING' : null;
      this.last = {status, last_completed_at: this.now(), counts: result.counts, counts_scope:'all_retained_jobs', current_counts:currentCounts, pending_jobs:pending.length, ...(reason ? {reason} : {})};
    } catch {this.last = {status: 'CYCLE_FAILED', last_completed_at: this.last.last_completed_at, reason: 'PRIVATE_WORKER_UNAVAILABLE'};}
    return this.status();
  }
  status() {return {...this.last, worker_running: this.active, publication_enabled: false, external_writes_enabled: false};}
  start() {
    if (this.active) return;
    this.active = true;
    const loop = async () => {
      if (!this.active) return;
      await this.cycle();
      // Retry due jobs every minute; new jobs still respect the polling interval.
      if (this.active) {this.timer = this.setTimer(loop, 60000); this.timer.unref?.();}
    };
    void loop();
  }
  async stop() {this.active = false; if (this.timer !== null) this.clearTimer(this.timer); if (this.inflight) await this.inflight;}
}
