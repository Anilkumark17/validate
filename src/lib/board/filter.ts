import type { BoardAssumption } from "./client";
import { riskBucket, type RiskBucket, type Status } from "./constants";

export interface Filters {
  q: string;
  risk: "all" | RiskBucket;
  status: "all" | Status;
  category: string;
  stakeholder: string;
  method: string;
  sort: "risk" | "newest" | "title";
}

export const NO_FILTERS: Filters = { q: "", risk: "all", status: "all", category: "all", stakeholder: "all", method: "all", sort: "risk" };

export const isFiltered = (f: Filters) => f.q.trim() !== "" || f.risk !== "all" || f.status !== "all" || f.category !== "all" || f.stakeholder !== "all" || f.method !== "all";

/** Search matches title or description. Every other filter must match too. Stable, never mutates its input. */
export function applyFilters(list: BoardAssumption[], f: Filters): BoardAssumption[] {
  const q = f.q.trim().toLowerCase();
  const out = list.filter((a) => {
    if (q && !a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
    if (f.risk !== "all" && riskBucket(a.risk ?? 0) !== f.risk) return false;
    if (f.status !== "all" && a.status !== f.status) return false;
    if (f.category !== "all" && a.category !== f.category) return false;
    if (f.stakeholder !== "all" && !a.stakeholderIds.includes(f.stakeholder)) return false;
    if (f.method !== "all" && a.validationMethod !== f.method) return false;
    return true;
  });
  const by = {
    risk: (a: BoardAssumption, b: BoardAssumption) => (b.risk ?? 0) - (a.risk ?? 0) || a.title.localeCompare(b.title),
    newest: (a: BoardAssumption, b: BoardAssumption) => b.createdAt.localeCompare(a.createdAt),
    title: (a: BoardAssumption, b: BoardAssumption) => a.title.localeCompare(b.title),
  }[f.sort];
  return [...out].sort(by);
}
