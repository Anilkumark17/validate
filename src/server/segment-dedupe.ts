/** Small in-memory helpers for transcript writes. Per process by design: no schema change needed. */

export class TtlMap<V> {
  private m = new Map<string, { exp: number; v: V }>();
  constructor(
    private ttlMs: number,
    private max = 2000,
    private now: () => number = Date.now,
  ) {}

  get(k: string): V | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (e.exp <= this.now()) {
      this.m.delete(k);
      return undefined;
    }
    return e.v;
  }

  set(k: string, v: V) {
    if (this.m.size >= this.max) {
      const t = this.now();
      for (const [key, e] of this.m) if (e.exp <= t) this.m.delete(key);
      if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value!);
    }
    this.m.set(k, { exp: this.now() + this.ttlMs, v });
  }

  delete(k: string) {
    this.m.delete(k);
  }
}

const g = globalThis as unknown as { __chunks?: TtlMap<Promise<unknown>> };

/** clientId -> in-flight or finished result. A retried POST gets the same result, never a second row. */
export const savedSegments = (g.__chunks ??= new TtlMap<Promise<unknown>>(5 * 60_000));
