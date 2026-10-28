"use client";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { PageState } from "@/components/app-shell";
import { NewProjectDialog } from "@/components/project-dialogs";
import { PageHeader, Shell } from "@/components/shell";
import { api, type Project } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";

const GROUPS = [{ items: [{ href: "/projects", label: "Projects", icon: FolderOpen, exact: true }] }];
const COLS = "md:grid-cols-[minmax(0,1fr)_180px_96px_96px_20px]";

export default function Home() {
  return (
    <RequireAuth>
      <Shell groups={GROUPS}>
        <Projects />
      </Shell>
    </RequireAuth>
  );
}

function Projects() {
  const { data, isLoading, error } = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  return (
    <main className="max-w-5xl">
      <PageHeader title="Projects" description="One project per idea. List what has to be true, interview customers, and record what you learn.">
        <NewProjectDialog />
      </PageHeader>
      <PageState loading={isLoading} error={error?.message} />
      {data?.length === 0 && (
        <section className="rounded-lg border border-dashed bg-card px-6 py-10">
          <h2 className="text-base font-semibold">Start with an idea</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Name it and describe it in a few sentences. Validate drafts the riskiest assumptions and the roles worth interviewing, then tracks each one until you have evidence either way.
          </p>
          <div className="mt-4">
            <NewProjectDialog />
          </div>
        </section>
      )}
      {data && data.length > 0 && (
        <section aria-label="Your projects" className="overflow-hidden rounded-lg border bg-card">
          <div className={`hidden gap-4 border-b px-4 py-2.5 text-xs text-muted-foreground md:grid ${COLS}`} aria-hidden>
            <span>Project</span>
            <span>Tested</span>
            <span className="text-right">Assumptions</span>
            <span className="text-right">Meetings</span>
            <span />
          </div>
          <ul className="divide-y divide-rule">
            {data.map((p) => {
              const pct = p.progressPercent ?? 0;
              return (
                <li key={p.id}>
                  <Link href={`/p/${p.id}`} className={`grid items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-muted/60 ${COLS} grid-cols-[minmax(0,1fr)_auto]`}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.targetUser || p.description || "No description yet"}</span>
                    </span>
                    <span className="flex items-center gap-2 max-md:order-last max-md:col-span-2" aria-label={`${pct}% of assumptions tested`}>
                      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-border max-md:flex-1" aria-hidden>
                        <span className="block h-full bg-chart" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="num w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                    </span>
                    <span className="num hidden text-right md:block">{p.assumptionTotal ?? 0}</span>
                    <span className="num hidden text-right md:block">{p.meetingCount ?? 0}</span>
                    <ChevronRight className="size-4 justify-self-end text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
