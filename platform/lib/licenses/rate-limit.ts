/**
 * A small in-memory limit on how often one address may try the redeem route.
 *
 * It is a speed bump, not a wall: it lives in one server instance's memory, so on a host that runs several
 * instances each keeps its own count, and a restart clears it. That is enough here, because a checkout
 * reference is 60-plus random characters and is only worth anything to the person Stripe sent it to. A host
 * that needs a firm limit should put one in front (its edge or WAF rules).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Count one try for `key`. False means: too many, refuse. */
  take(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => t - at < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.prune(t);
    return true;
  }

  private prune(t: number): void {
    for (const [key, list] of this.hits) if (list.every((at) => t - at >= this.windowMs)) this.hits.delete(key);
  }
}
