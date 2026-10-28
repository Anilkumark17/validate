import { ProjectShell } from "@/components/project-nav";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectShell projectId={projectId}>{children}</ProjectShell>;
}
