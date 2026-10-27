"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageState, TopBar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/form";
import { api, type Project } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";

function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (v: { name: string; description: string; targetUser: string }) =>
      api<Project>("/projects", { method: "POST", json: v }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      router.push(`/p/${p.id}/meetings`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New project
        </Button>
      </DialogTrigger>
      <DialogContent title="New project" description="A project holds your meetings.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            create.mutate({
              name: String(f.get("name")),
              description: String(f.get("description") ?? ""),
              targetUser: String(f.get("targetUser") ?? ""),
            });
          }}
        >
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={120} placeholder="Meal planning app for busy parents" autoFocus />
          </div>
          <div>
            <Label htmlFor="targetUser">Target user</Label>
            <Input id="targetUser" name="targetUser" maxLength={300} placeholder="Working parents with kids under 10" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" maxLength={2000} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  return (
    <RequireAuth>
      <Projects />
    </RequireAuth>
  );
}

function Projects() {
  const { data, isLoading, error } = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  return (
    <>
      <TopBar>
        <NewProjectDialog />
      </TopBar>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Create a project, start a meeting, and get a live transcript.</p>
        </div>
        <PageState loading={isLoading} error={error?.message} empty={data?.length === 0} emptyText="No projects yet. Create one to start." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((p) => {
            return (
              <Link
                key={p.id}
                href={`/p/${p.id}`}
                className="group rounded-lg border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <FolderKanban className="mt-0.5 size-5 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">{p.name}</h2>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{p.targetUser || p.description || "No description"}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  <Video className="size-3" aria-hidden /> {p.meetingCount ?? 0} meeting{p.meetingCount === 1 ? "" : "s"}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
