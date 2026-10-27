import type { Segment } from "@/lib/api";

const sortKey = (s: Pick<Segment, "startSec" | "idx">) => [s.startSec ?? Number.POSITIVE_INFINITY, s.idx] as const;
const before = (a: Segment, b: Segment) => {
  const [as, ai] = sortKey(a);
  const [bs, bi] = sortKey(b);
  return as < bs || (as === bs && ai < bi);
};

/** Adds a segment in chronological order. Returns the same array when the id is already present. */
export function insertSegment(list: Segment[], seg: Segment): Segment[] {
  if (list.some((s) => s.id === seg.id)) return list;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (before(list[mid]!, seg)) lo = mid + 1;
    else hi = mid;
  }
  return [...list.slice(0, lo), seg, ...list.slice(lo)];
}
