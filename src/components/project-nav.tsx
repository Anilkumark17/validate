"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/app-shell";
import { api, type Project } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ProjectHeader({ projectId, children }: { projectId: string; children?: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useQuery({ queryKey: ["project", projectId], queryFn: () => api<Project>(`/projects/${projectId}`) });
  const tabs = [
    { href: `/p/${projectId}`, label: "Board" },
    { href: `/p/${projectId}/meetings`, label: "Meetings" },
    { href: `/p/${projectId}/matrix`, label: "Matrix" },
    { href: `/p/${projectId}/persona`, label: "Persona" },
    { href: `/p/${projectId}/voice`, label: "Facts and voice" },
    { href: `/p/${projectId}/ideate`, label: "Map an idea" },
  ];
  return (
    <>
      <TopBar crumbs={<><span aria-hidden>/</span><span className="truncate font-medium text-foreground">{data?.name ?? "…"}</span></>}>{children}</TopBar>
      <nav className="border-b bg-background" aria-label="Project sections">
        <div className="mx-auto flex max-w-[1500px] gap-1 px-4 sm:px-6">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={pathname === t.href ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium",
                pathname === t.href ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
