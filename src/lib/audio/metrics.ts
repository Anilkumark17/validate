export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!;
}

export interface LatencyStats {
  n: number;
  p50: number;
  p95: number;
}

/** Fixed-size window of recent samples. */
export class Window {
  private v: number[] = [];
  constructor(private max = 200) {}
  add(x: number) {
    this.v.push(x);
    if (this.v.length > this.max) this.v.shift();
  }
  stats(): LatencyStats {
    return { n: this.v.length, p50: percentile(this.v, 50), p95: percentile(this.v, 95) };
  }
}
