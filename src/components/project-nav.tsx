"use client";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/app-shell";
import { api, type Project } from "@/lib/api";

export function ProjectHeader({ projectId, children }: { projectId: string; children?: React.ReactNode }) {
  const { data } = useQuery({ queryKey: ["project", projectId], queryFn: () => api<Project>(`/projects/${projectId}`) });
  return (
    <TopBar crumbs={<><span aria-hidden>/</span><span className="truncate font-medium text-foreground">{data?.name ?? "…"}</span></>}>{children}</TopBar>
  );
}
