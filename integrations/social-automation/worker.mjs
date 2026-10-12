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
      for (const [platform, grant] of Object.entries(state.connections)) {
        if (grant.status !== 'connected' || grant.expires_at <= this.now() || typeof this.runtime.adapters[platform]?.read_media !== 'function') continue;
        if (state.jobs.some(j => j.platform === platform && j.operation === 'read_media' && ['queued', 'retry'].includes(j.status))) continue;
        const account = crypto.createHash('sha256').update(grant.account_id).digest('hex').slice(0, 16);
        await this.runtime.enqueue({id: `poll_${platform}_${account}_${Math.floor(this.now() / this.intervalMs)}`, platform, operation: 'read_media'});
      }
      const result = await this.runtime.tick();
      this.last = {status: 'CYCLE_COMPLETED', last_completed_at: this.now(), counts: result.counts};
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
