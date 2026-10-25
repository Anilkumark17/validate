export type Stance = "supports" | "contradicts" | "neutral";
export type Status = "untested" | "supporting" | "contradicted" | "mixed" | "validated" | "invalidated";

export interface StatusLink {
  stance: Stance;
  strength: number;
  speaker: string | null;
  rejected: boolean;
}

export const STATUS_THRESHOLDS = {
  speakerClamp: 3,
  invalidated: { minContradict: 3, minSpeakers: 2, maxSupportRatio: 0.34 },
  validated: { minSupport: 6, minSpeakers: 3, maxContradictRatio: 0.2 },
  mixedRatio: 0.4,
  confidenceScale: 10,
} as const;

export interface StatusResult {
  status: Status;
  confidence: number;
  support: number;
  contradict: number;
  supportSpeakers: number;
  contradictSpeakers: number;
}

export function computeStatus(links: StatusLink[]): StatusResult {
  const T = STATUS_THRESHOLDS;
  const net = new Map<string, number>();
  let counted = 0;
  for (const l of links) {
    if (l.rejected || l.stance === "neutral") continue;
    counted++;
    const key = l.speaker?.trim().toLowerCase() || "unknown";
    const delta = l.stance === "supports" ? l.strength : -l.strength;
    net.set(key, (net.get(key) ?? 0) + delta);
  }
  if (counted === 0) {
    return { status: "untested", confidence: 0, support: 0, contradict: 0, supportSpeakers: 0, contradictSpeakers: 0 };
  }
  let support = 0;
  let contradict = 0;
  let supportSpeakers = 0;
  let contradictSpeakers = 0;
  for (const raw of net.values()) {
    const n = Math.max(-T.speakerClamp, Math.min(T.speakerClamp, raw));
    if (n > 0) {
      support += n;
      supportSpeakers++;
    } else if (n < 0) {
      contradict += -n;
      contradictSpeakers++;
    }
  }
  const total = support + contradict;
  let status: Status;
  if (total === 0) {
    status = "untested";
  } else if (
    contradict >= T.invalidated.minContradict &&
    contradictSpeakers >= T.invalidated.minSpeakers &&
    support <= contradict * T.invalidated.maxSupportRatio
  ) {
    status = "invalidated";
  } else if (
    support >= T.validated.minSupport &&
    supportSpeakers >= T.validated.minSpeakers &&
    contradict <= support * T.validated.maxContradictRatio
  ) {
    status = "validated";
  } else if (support > 0 && contradict > 0 && Math.min(support, contradict) / Math.max(support, contradict) >= T.mixedRatio) {
    status = "mixed";
  } else if (support > contradict) {
    status = "supporting";
  } else {
    status = "contradicted";
  }
  const confidence = total === 0 ? 0 : Math.min(1, total / T.confidenceScale) * (Math.max(support, contradict) / total);
  return { status, confidence, support, contradict, supportSpeakers, contradictSpeakers };
}
