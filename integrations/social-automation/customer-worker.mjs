export class CustomerOnboardingWorker {
  constructor({onboarding, intervalMs = 60000, setTimer = setTimeout, clearTimer = clearTimeout}) {
    if (!onboarding || typeof onboarding.runDue !== 'function' ||
        !Number.isFinite(intervalMs) || intervalMs < 60000) throw Error('INVALID_CUSTOMER_WORKER_CONFIGURATION');
    Object.assign(this, {onboarding, intervalMs, setTimer, clearTimer});
    this.active = false;
    this.inflight = null;
    this.timer = null;
    this.last = {status:'NOT_STARTED', last_completed_at:null};
  }
  cycle() {
    if (this.inflight) return this.inflight;
    this.inflight = this.run().finally(() => {this.inflight = null;});
    return this.inflight;
  }
  async run() {
    try {
      const result = await this.onboarding.runDue();
      this.last = {status:result.failed ? 'CYCLE_PARTIAL' : 'CYCLE_COMPLETED',
        last_completed_at:Date.now(), processed:result.processed, failed:result.failed};
    } catch {
      this.last = {status:'CYCLE_FAILED', last_completed_at:this.last.last_completed_at,
        reason:'CUSTOMER_WORKER_UNAVAILABLE'};
    }
    return this.status();
  }
  status() {return {...this.last, worker_running:this.active, publication_enabled:false, external_writes_enabled:false};}
  start() {
    if (this.active) return;
    this.active = true;
    const loop = async() => {
      if (!this.active) return;
      await this.cycle();
      if (this.active) {this.timer = this.setTimer(loop, this.intervalMs); this.timer.unref?.();}
    };
    void loop();
  }
  async stop() {
    this.active = false;
    if (this.timer !== null) this.clearTimer(this.timer);
    if (this.inflight) await this.inflight;
  }
}
