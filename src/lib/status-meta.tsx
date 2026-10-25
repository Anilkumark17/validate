import { CheckCheck, CircleDashed, ShieldAlert, ThumbsDown, ThumbsUp, Scale, type LucideIcon } from "lucide-react";
import type { Assumption } from "./api";

export const STATUS_META: Record<
  Assumption["status"],
  { label: string; icon: LucideIcon; text: string; bg: string; dot: string }
> = {
  untested: { label: "Untested", icon: CircleDashed, text: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800", dot: "bg-slate-400" },
  supporting: { label: "Supporting", icon: ThumbsUp, text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950", dot: "bg-emerald-500" },
  mixed: { label: "Mixed", icon: Scale, text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950", dot: "bg-amber-500" },
  contradicted: { label: "Contradicted", icon: ThumbsDown, text: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-950", dot: "bg-orange-500" },
  validated: { label: "Validated", icon: CheckCheck, text: "text-teal-700 dark:text-teal-300", bg: "bg-teal-50 dark:bg-teal-950", dot: "bg-teal-600" },
  invalidated: { label: "Invalidated", icon: ShieldAlert, text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-950", dot: "bg-rose-600" },
};

export const STATUS_ORDER: Assumption["status"][] = ["untested", "supporting", "mixed", "contradicted", "validated", "invalidated"];

export function StatusBadge({ status, className = "" }: { status: Assumption["status"]; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.bg} ${m.text} ${className}`}>
      <Icon className="size-3" aria-hidden />
      {m.label}
    </span>
  );
}

export const TYPE_LABEL = { desirability: "Desirability", feasibility: "Feasibility", viability: "Viability" } as const;
