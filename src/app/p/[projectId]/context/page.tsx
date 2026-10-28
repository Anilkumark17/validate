"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/form";
import { api, type ContextEntry } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { MAX_CONTEXT_CHARS } from "@/lib/schemas";

export default function ContextPage() {
  return (
    <RequireAuth>
      <Context />
    </RequireAuth>
  );
}

function EntryDialog({
  projectId,
  entry,
  open,
  onOpenChange,
}: {
  projectId: string;
  entry: ContextEntry | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [content, setContent] = useState(entry?.content ?? "");
  const save = useMutation({
    mutationFn: (v: { title: string; content: string }) =>
      entry
        ? api<ContextEntry>(`/projects/${projectId}/context/${entry.id}`, { method: "PATCH", json: v })
        : api<ContextEntry>(`/projects/${projectId}/context`, { method: "POST", json: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["context", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      onOpenChange(false);
      toast.success(entry ? "Context updated" : "Context added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={entry ? "Edit context" : "Add context"}
        description="Plain text only for now. Add anything relevant to this project."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({ title: String(f.get("title")), content });
          }}
        >
          <div>
            <Label htmlFor="ctx-title">Title</Label>
            <Input id="ctx-title" name="title" required maxLength={120} defaultValue={entry?.title} placeholder="Target customers" autoFocus />
          </div>
          <div>
            <Label htmlFor="ctx-content">Text</Label>
            <Textarea
              id="ctx-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={10}
              maxLength={MAX_CONTEXT_CHARS}
              placeholder="Background, goals, constraints, what we already know…"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {content.length.toLocaleString()} / {MAX_CONTEXT_CHARS.toLocaleString()}
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending || !content.trim()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Context() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const key = ["context", projectId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<ContextEntry[]>(`/projects/${projectId}/context`) });
  const [editing, setEditing] = useState<ContextEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/projects/${projectId}/context/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <main className="max-w-4xl">
        <ProjectHeader projectId={projectId}>
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add context
          </Button>
        </ProjectHeader>
        <PageState loading={isLoading} error={error?.message} empty={data?.length === 0} emptyText="No context yet. Add the first entry." />
        <ul className="space-y-3">
          {data?.map((c) => (
            <li key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 truncate font-medium">{c.title}</h2>
                <Button size="icon" variant="ghost" aria-label={`Edit ${c.title}`} onClick={() => setEditing(c)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${c.title}`}
                  disabled={remove.isPending}
                  onClick={() => confirm(`Delete "${c.title}"?`) && remove.mutate(c.id)}
                >
                  <Trash2 />
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">Updated {new Date(c.updatedAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </main>
      {adding && <EntryDialog key="new" projectId={projectId} entry={null} open onOpenChange={(o) => !o && setAdding(false)} />}
      {editing && <EntryDialog key={editing.id} projectId={projectId} entry={editing} open onOpenChange={(o) => !o && setEditing(null)} />}
    </>
  );
}
