"use client";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Columns3, FileText, History, LayoutDashboard, MessagesSquare, StickyNote, Users, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader, Shell, type NavGroup } from "@/components/shell";
import { api, type Project } from "@/lib/api";
import { useBoard } from "@/lib/board/client";

function groups(id: string): NavGroup[] {
  const base = `/p/${id}`;
  return [
    {
      items: [
        { href: base, label: "Overview", icon: LayoutDashboard, exact: true },
        { href: `${base}/board`, label: "Assumption board", icon: Columns3 },
      ],
    },
    {
      label: "Research",
      items: [
        { href: `${base}/meetings`, label: "Meetings", icon: Video },
        { href: `${base}/questions`, label: "Question bank", icon: MessagesSquare },
        { href: `${base}/stakeholders`, label: "Stakeholders", icon: Users },
        { href: `${base}/evidence`, label: "Evidence", icon: FileText },
      ],
    },
    {
      label: "Record",
      items: [
        { href: `${base}/decisions`, label: "Decision history", icon: History },
        { href: `${base}/context`, label: "Context", icon: StickyNote },
      ],
    },
  ];
}

/** Where you are and how far along it is. Replaces the old strip that sat above every page. */
function ProjectScope({ projectId }: { projectId: string }) {
  const { data: project } = useQuery({ queryKey: ["project", projectId], queryFn: () => api<Project>(`/projects/${projectId}`) });
  const { data: board } = useBoard(projectId);
  const p = board?.progress;
  const tested = p ? p.validated + p.invalidated : 0;
  return (
    <div className="mt-6 px-2.5">
      <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" aria-hidden /> All projects
      </Link>
      <p className="mt-1.5 truncate text-sm font-medium" title={project?.name}>
        {project?.name ?? " "}
      </p>
      {p && p.total > 0 && (
        <div className="mt-2">
          <div
            className="h-1 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={p.percent}
            aria-label={`${p.percent}% of assumptions tested`}
          >
            <div className="h-full bg-chart transition-[width]" style={{ width: `${p.percent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="num text-foreground">{tested}</span> of <span className="num">{p.total}</span> tested
          </p>
        </div>
      )}
    </div>
  );
}

/** Sidebar and canvas for every project page. The setup step stays a focused page without navigation. */
export function ProjectShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.endsWith("/setup")) return <>{children}</>;
  return (
    <Shell groups={groups(projectId)} scope={<ProjectScope projectId={projectId} />}>
      {children}
    </Shell>
  );
}

const PAGES: Record<string, { title: string; description: string }> = {
  board: { title: "Assumption board", description: "Drag cards between columns. Open one for its evidence." },
  meetings: { title: "Meetings", description: "Schedule interviews and share the invite link." },
  evidence: { title: "Evidence", description: "What you learned, kept apart from the assumption." },
  stakeholders: { title: "Stakeholders", description: "Who can confirm or refute your assumptions." },
  decisions: { title: "Decision history", description: "Every status change, newest first." },
  questions: { title: "Question bank", description: "Ask about past behavior, never what people would do." },
  context: { title: "Context", description: "Background for this project. Only you can see it." },
};

/** Title row for a project page. The title and sentence come from the route unless the page passes its own. */
export function ProjectHeader({
  projectId,
  title,
  description,
  children,
}: {
  projectId: string;
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const key = pathname.replace(`/p/${projectId}/`, "").split("/")[0] ?? "";
  const page = PAGES[key];
  return (
    <PageHeader title={title ?? page?.title ?? "Overview"} description={description ?? page?.description}>
      {children}
    </PageHeader>
  );
}
