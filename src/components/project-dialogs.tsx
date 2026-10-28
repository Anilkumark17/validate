"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/form";
import { api, type Project } from "@/lib/api";
import { MAX_CONTEXT_CHARS } from "@/lib/schemas";

/** Creation asks for a name and the idea only. Audience and generation follow on the setup page. */
export function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (v: { name: string; idea: string }) => api<Project>("/projects", { method: "POST", json: v }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      router.push(`/p/${p.id}/setup`);
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
      <DialogContent title="New project" description="Tell us the idea. We will suggest the riskiest assumptions and who to ask.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            create.mutate({ name: String(f.get("name")), idea: String(f.get("idea")) });
          }}
        >
          <div>
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" required maxLength={120} placeholder="MealMate" autoFocus />
          </div>
          <div>
            <Label htmlFor="idea">Project idea</Label>
            <Textarea
              id="idea"
              name="idea"
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              placeholder="An app that helps busy parents decide what to cook every day based on their family's preferences and available ingredients."
            />
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

function EditFields({ project, onDone }: { project: Project; onDone: () => void }) {
  const qc = useQueryClient();
  const [context, setContext] = useState(project.context ?? "");
  const save = useMutation({
    mutationFn: (v: { name: string; targetUser: string; description: string; context: string }) =>
      api<Project>(`/projects/${project.id}`, { method: "PATCH", json: v }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["project", p.id] });
      void qc.invalidateQueries({ queryKey: ["context", p.id] });
      void qc.invalidateQueries({ queryKey: ["board", p.id] });
      toast.success("Project updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save.mutate({
          name: String(f.get("name")),
          targetUser: String(f.get("targetUser") ?? ""),
          description: String(f.get("description") ?? ""),
          context,
        });
      }}
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={120} defaultValue={project.name} autoFocus />
      </div>
      <div>
        <Label htmlFor="targetUser">Target user</Label>
        <Input id="targetUser" name="targetUser" maxLength={300} defaultValue={project.targetUser ?? ""} placeholder="Working parents with kids under 10" />
      </div>
      <div>
        <Label htmlFor="description">Project idea</Label>
        <Textarea id="description" name="description" maxLength={4000} defaultValue={project.description ?? ""} />
      </div>
      <div>
        <Label htmlFor="context">Context</Label>
        <Textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={6}
          maxLength={MAX_CONTEXT_CHARS}
          placeholder="Background, goals, constraints, what we already know… (plain text)"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Saved as the “Project context” note on the Context tab and used when you refine assumptions. Leave empty to remove it. {context.length.toLocaleString()} / {MAX_CONTEXT_CHARS.toLocaleString()}
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function EditProjectDialog({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil /> Edit project
        </Button>
      </DialogTrigger>
      <DialogContent title="Edit project" description="Change the details or the project context.">
        {/* remount on open so the form always starts from the latest saved values */}
        {open && <EditFields project={project} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
