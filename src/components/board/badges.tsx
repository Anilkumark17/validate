import { riskBucket, STATUS_LABEL, type Status } from "@/lib/board/constants";
import { cn } from "@/lib/utils";

/**
 * Status is always a word. Colour is spent sparingly: the data hue marks validated, amber marks the
 * one state that needs more work, everything else is neutral.
 */
const STATUS_STYLE: Record<Status, string> = {
  generated: "bg-muted text-muted-foreground",
  ready_to_validate: "bg-muted text-foreground",
  validation_in_progress: "bg-muted text-foreground",
  evidence_collected: "bg-muted text-foreground",
  validated: "bg-chart-tint text-chart-ink",
  invalidated: "bg-border text-foreground",
  needs_more_evidence: "bg-warning-tint text-warning",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-xs font-medium", STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const RISK_DOT = { high: "bg-destructive", medium: "bg-warning", low: "bg-input" } as const;
const RISK_WORD = { high: "high", medium: "medium", low: "low" } as const;

/** A dot and words, so risk never rests on colour alone. Red is kept for the high bucket. */
export function RiskBadge({ risk, className }: { risk: number | null; className?: string }) {
  if (risk == null) return null;
  const b = riskBucket(risk);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", className)} title={`Risk ${risk} of 25 (impact x uncertainty)`}>
      <span className={cn("size-2 rounded-full", RISK_DOT[b])} aria-hidden />
      <span className="num font-medium">{risk}</span>
      <span className="text-muted-foreground">{RISK_WORD[b]}</span>
    </span>
  );
}
