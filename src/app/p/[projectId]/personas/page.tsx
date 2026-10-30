"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2, Undo2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { RegenerateButton } from "@/components/board/regenerate-button";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/form";
import { api, type Persona } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";

export default function PersonasPage() {
  return (
    <RequireAuth>
      <Personas />
    </RequireAuth>
  );
}

function NewPersonaDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (v: object) => api<Persona>(`/projects/${projectId}/personas`, { method: "POST", json: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas", projectId] });
      toast.success("Persona saved as a draft");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Add persona" description="Saved as a draft. Approve it when you are happy with it.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const s = (k: string) => String(f.get(k) ?? "");
            create.mutate({
              name: s("name"),
              summary: s("summary"),
              jtbdSummary: s("jtbdSummary"),
              mindsetSummary: s("mindsetSummary"),
              segmentHints: s("segmentHints").split(",").map((x) => x.trim()).filter(Boolean),
              systemPrompt: s("systemPrompt"),
            });
          }}
        >
          <div>
            <Label htmlFor="pn">Name</Label>
            <Input id="pn" name="name" required maxLength={120} autoFocus placeholder="The skeptical first-time buyer" />
          </div>
          <div>
            <Label htmlFor="ps">Summary</Label>
            <Textarea id="ps" name="summary" rows={2} maxLength={1000} />
          </div>
          <div>
            <Label htmlFor="pj">Jobs to be done</Label>
            <Textarea id="pj" name="jtbdSummary" rows={2} maxLength={1000} />
          </div>
          <div>
            <Label htmlFor="pm">Mindset</Label>
            <Textarea id="pm" name="mindsetSummary" rows={2} maxLength={1000} />
          </div>
          <div>
            <Label htmlFor="ph">Segments (comma separated)</Label>
            <Input id="ph" name="segmentHints" placeholder="solo founder, B2B" />
          </div>
          <div>
            <Label htmlFor="pp">System prompt</Label>
            <Textarea id="pp" name="systemPrompt" rows={5} maxLength={8000} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Save draft"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{text}</p>
    </div>
  );
}

function Personas() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const key = ["personas", projectId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<Persona[]>(`/projects/${projectId}/personas`) });
  const [adding, setAdding] = useState(false);
  const done = { onSuccess: () => qc.invalidateQueries({ queryKey: key }), onError: (e: Error) => toast.error(e.message) };
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "draft" | "approved" }) =>
      api<Persona>(`/projects/${projectId}/personas/${v.id}`, { method: "PATCH", json: { status: v.status } }),
    ...done,
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/projects/${projectId}/personas/${id}`, { method: "DELETE" }), ...done });

  return (
    <>
      <main className="max-w-5xl">
        <ProjectHeader projectId={projectId}>
          <RegenerateButton projectId={projectId} />
          <Button onClick={() => setAdding(true)}><Plus /> Add persona</Button>
        </ProjectHeader>
        <PageState loading={isLoading} error={error?.message} empty={data?.length === 0} emptyText="No personas yet. Add the first one." />
        <ul className="grid gap-4 md:grid-cols-2">
          {data?.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium">{p.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    <span className={p.status === "approved" ? "text-foreground" : ""}>{p.status === "approved" ? "Approved" : "Draft"}</span>
                    {p.sourceCustomerCount > 0 && <> · built from {p.sourceCustomerCount} customers</>}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={p.status === "draft" ? `Approve ${p.name}` : `Move ${p.name} back to draft`}
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: p.id, status: p.status === "draft" ? "approved" : "draft" })}
                >
                  {p.status === "draft" ? <Check /> : <Undo2 />}
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`} disabled={remove.isPending} onClick={() => confirm(`Delete "${p.name}"?`) && remove.mutate(p.id)}>
                  <Trash2 />
                </Button>
              </div>
              <Section title="Summary" text={p.summary} />
              <Section title="Jobs to be done" text={p.jtbdSummary} />
              <Section title="Mindset" text={p.mindsetSummary} />
              {p.segmentHints.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.segmentHints.map((s) => <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs">{s}</span>)}
                </div>
              )}
              {p.systemPrompt && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">System prompt</summary>
                  <p className="mt-1 whitespace-pre-wrap break-words">{p.systemPrompt}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      </main>
      {adding && <NewPersonaDialog projectId={projectId} onClose={() => setAdding(false)} />}
    </>
  );
}
