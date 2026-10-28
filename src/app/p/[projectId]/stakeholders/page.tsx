"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { StakeholderDialog } from "@/components/board/stakeholder-dialog";
import { ProjectHeader } from "@/components/project-nav";
import { CoverageBar, RolePanel } from "@/components/stakeholders/role-panel";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { refreshBoard, useBoard, type BoardStakeholder } from "@/lib/board/client";
import { MIN_INTERVIEWS_PER_STAKEHOLDER } from "@/lib/board/constants";
import { cn } from "@/lib/utils";

export default function StakeholdersPage() {
  return (
    <RequireAuth>
      <Stakeholders />
    </RequireAuth>
  );
}

const PRIORITY_DOT = { high: "bg-warning", medium: "bg-input", low: "bg-border" } as const;

function Stakeholders() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const { data, isLoading, error } = useBoard(projectId);
  const [picked, setPicked] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (s: BoardStakeholder) => api(`/projects/${projectId}/stakeholders/${s.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Stakeholder removed");
      setPicked(null);
      refreshBoard(qc, projectId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roles = [...(data?.stakeholders ?? [])].sort((a, b) => b.relevance - a.relevance);
  const role = roles.find((r) => r.id === picked) ?? roles[0];

  return (
    <main className="max-w-6xl">
      <ProjectHeader projectId={projectId}>{data && <StakeholderDialog projectId={projectId} assumptions={data.assumptions} variant="outline" />}</ProjectHeader>
      <PageState loading={isLoading} error={error?.message} />
      {data && roles.length === 0 && (
        <section className="rounded-lg border border-dashed bg-card px-6 py-10">
          <h2 className="text-base font-semibold">No roles yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">A role is a kind of person to interview, such as parents who plan family meals. Add one, or refine the project to suggest some.</p>
        </section>
      )}
      {data && role && (
        <div className="grid gap-5 lg:grid-cols-[288px_minmax(0,1fr)]">
          <nav aria-label="Stakeholder roles" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {roles.map((r) => {
              const on = r.id === role.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-current={on ? "true" : undefined}
                  onClick={() => setPicked(r.id)}
                  className={cn(
                    "w-60 shrink-0 rounded-lg border px-3.5 py-3 text-left lg:w-full",
                    on ? "border-border bg-card" : "border-transparent hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_DOT[r.interviewPriority])} aria-hidden />
                    <span className={cn("min-w-0 flex-1 truncate text-sm", on && "font-medium")}>{r.roleName}</span>
                    <span className="sr-only">{r.interviewPriority} priority</span>
                  </span>
                  <span className="mt-2 flex items-center gap-2.5">
                    <CoverageBar done={r.interviewCount} className="w-16" />
                    <span className="num text-xs text-muted-foreground">
                      {r.interviewCount} of {MIN_INTERVIEWS_PER_STAKEHOLDER} interviews
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
          <RolePanel key={role.id} projectId={projectId} role={role} assumptions={data.assumptions} deleting={remove.isPending} onDelete={() => remove.mutate(role)} />
        </div>
      )}
    </main>
  );
}
