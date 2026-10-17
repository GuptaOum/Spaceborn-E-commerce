/**
 * Per-process circuit breaker. After `threshold` consecutive failures calls are refused for
 * `cooldownMs`; then a single trial call decides whether to close again or stay open.
 */
export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  private trialInFlight = false;

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): 'closed' | 'open' | 'half-open' {
    if (this.failures < this.threshold) return 'closed';
    return this.now() < this.openUntil ? 'open' : 'half-open';
  }

  /** Whether a call may go ahead. In half-open state only one caller gets a yes. */
  tryAcquire(): boolean {
    const state = this.state;
    if (state === 'closed') return true;
    if (state === 'open' || this.trialInFlight) return false;
    this.trialInFlight = true;
    return true;
  }

  success() {
    this.failures = 0;
    this.trialInFlight = false;
  }

  failure() {
    this.failures += 1;
    this.trialInFlight = false;
    if (this.failures >= this.threshold) this.openUntil = this.now() + this.cooldownMs;
  }

  /** The call ended without telling us anything about the dependency (e.g. the customer hung up). */
  release() {
    this.trialInFlight = false;
  }
}
