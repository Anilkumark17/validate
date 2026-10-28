"use client";
import { AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";
import { RiskBadge, StatusBadge } from "@/components/board/badges";
import { StakeholderDialog } from "@/components/board/stakeholder-dialog";
import { Button } from "@/components/ui/button";
import { Clamp } from "@/components/ui/clamp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BoardAssumption, BoardStakeholder } from "@/lib/board/client";
import { MIN_INTERVIEWS_PER_STAKEHOLDER } from "@/lib/board/constants";
import { cn } from "@/lib/utils";

const PRIORITY_WORD = { high: "High", medium: "Medium", low: "Low" } as const;

/** Coverage in one glance: filled to the interviews recorded out of the suggested minimum. */
export function CoverageBar({ done, className }: { done: number; className?: string }) {
  const pct = Math.min(100, (done / MIN_INTERVIEWS_PER_STAKEHOLDER) * 100);
  return (
    <span className={cn("block h-1 overflow-hidden rounded-full bg-border", className)} aria-hidden>
      <span className={cn("block h-full", done >= MIN_INTERVIEWS_PER_STAKEHOLDER ? "bg-chart" : "bg-input")} style={{ width: `${pct}%` }} />
    </span>
  );
}

export function RolePanel({
  projectId,
  role,
  assumptions,
  onDelete,
  deleting,
}: {
  projectId: string;
  role: BoardStakeholder;
  assumptions: BoardAssumption[];
  onDelete: () => void;
  deleting: boolean;
}) {
  const linked = assumptions.filter((a) => role.assumptionIds.includes(a.id)).sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0));
  const gap = role.assumptionIds.length > 0 && role.interviewCount < MIN_INTERVIEWS_PER_STAKEHOLDER;
  const stats: [string, React.ReactNode][] = [
    ["Interviews", <><span className="num">{role.interviewCount}</span><span className="text-muted-foreground"> of <span className="num">{MIN_INTERVIEWS_PER_STAKEHOLDER}</span></span></>],
    ["Evidence", <span className="num">{role.evidenceCount}</span>],
    ["Assumptions", <span className="num">{role.assumptionIds.length}</span>],
    ["Priority", PRIORITY_WORD[role.interviewPriority]],
  ];
  const facts: [string, string][] = [
    ["Why they matter", role.whyItMatters],
    ["Who to recruit", role.recruitmentCriteria],
    ["What you will learn", role.expectedEvidence],
  ];

  return (
    <section aria-label={role.roleName} className="rounded-lg border bg-card">
      <div className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold leading-7 tracking-tight">{role.roleName}</h2>
          {role.description && <Clamp text={role.description} className="mt-1 text-sm text-muted-foreground" />}
        </div>
        <StakeholderDialog projectId={projectId} stakeholder={role} assumptions={assumptions} />
        <Button variant="ghost" size="icon" aria-label={`Remove ${role.roleName}`} disabled={deleting} onClick={() => confirm(`Remove ${role.roleName}?`) && onDelete()}>
          <Trash2 />
        </Button>
      </div>

      <dl className="mx-5 mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-rule sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-lg font-medium leading-6">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mx-5 mt-4 flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href={`/p/${projectId}/questions?role=${role.id}`}>Prepare questions</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/p/${projectId}/meetings`}>Plan an interview</Link>
        </Button>
        {gap && (
          <span className="inline-flex items-center gap-1.5 text-xs text-warning" role="status">
            <AlertTriangle className="size-3.5" aria-hidden /> <span className="num">{MIN_INTERVIEWS_PER_STAKEHOLDER - role.interviewCount}</span> more interviews suggested
          </span>
        )}
      </div>

      <Tabs defaultValue="about" className="mt-5">
        <TabsList className="px-3">
          <TabsTrigger value="about" className="flex-none px-3.5">About</TabsTrigger>
          <TabsTrigger value="assumptions" className="flex-none px-3.5">
            Assumptions <span className="num ml-1 text-xs font-normal text-muted-foreground">{linked.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="about" className="px-5 pb-5 pt-4">
          {facts.every(([, v]) => !v) ? (
            <p className="text-sm text-muted-foreground">Nothing written yet. Use the pencil to add who they are and what to ask.</p>
          ) : (
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {facts.map(([label, v]) =>
                v ? (
                  <div key={label} className={label === "Why they matter" ? "sm:col-span-2" : undefined}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-[15px] leading-6">
                      <Clamp text={v} />
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          )}
        </TabsContent>
        <TabsContent value="assumptions" className="pb-2">
          {linked.length === 0 ? (
            <p className="px-5 pb-4 pt-4 text-sm text-muted-foreground">No assumptions linked. Use the pencil to choose which ones this role can answer.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {linked.map((a) => (
                <li key={a.id}>
                  <Link href={`/p/${projectId}/board`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/60">
                    <span className="w-24 shrink-0"><RiskBadge risk={a.risk} /></span>
                    <span className="min-w-0 flex-1 basis-56">{a.title}</span>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
