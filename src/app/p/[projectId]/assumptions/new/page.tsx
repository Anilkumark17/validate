"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { api, type Assumption } from "@/lib/api";

interface Draft {
  statement: string;
  type: Assumption["type"];
  risk: number;
}

export default function NewAssumptionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [statement, setStatement] = useState("");
  const [type, setType] = useState<Draft["type"]>("desirability");
  const [risk, setRisk] = useState(3);
  const [owner, setOwner] = useState("");

  const save = useMutation({
    mutationFn: (items: (Draft & { owner?: string })[]) => api(`/projects/${projectId}/assumptions`, { method: "POST", json: items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assumptions", projectId] });
      toast.success("Assumptions saved");
      router.push(`/p/${projectId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const draft = useMutation({
    mutationFn: () => api<Draft[]>(`/projects/${projectId}/assumptions/draft`, { method: "POST", json: { text } }),
    onSuccess: (d) => setDrafts(d),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <ProjectHeader projectId={projectId} />
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2">
        <section aria-labelledby="manual">
          <h2 id="manual" className="text-lg font-semibold">Add manually</h2>
          <form
            className="mt-4 space-y-4 rounded-lg border bg-card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate([{ statement, type, risk, owner: owner || undefined }]);
            }}
          >
            <div>
              <Label htmlFor="statement">Assumption</Label>
              <Textarea id="statement" value={statement} onChange={(e) => setStatement(e.target.value)} required minLength={3} placeholder="Parents plan dinners on Sunday for the whole week." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" value={type} onChange={(e) => setType(e.target.value as Draft["type"])}>
                  <option value="desirability">Desirability</option>
                  <option value="feasibility">Feasibility</option>
                  <option value="viability">Viability</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="risk">Risk if wrong (1 to 5)</Label>
                <Select id="risk" value={risk} onChange={(e) => setRisk(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="owner">Owner (optional)</Label>
              <Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
            </div>
            <Button type="submit" disabled={save.isPending}>Add assumption</Button>
          </form>
        </section>

        <section aria-labelledby="draft">
          <h2 id="draft" className="text-lg font-semibold">Draft from text</h2>
          <div className="mt-4 space-y-3 rounded-lg border bg-card p-5">
            <Label htmlFor="ctx">Paste a PRD, pitch, or idea</Label>
            <Textarea id="ctx" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="At least a few sentences about the product and who it is for." />
            <Button variant="secondary" disabled={text.trim().length < 20 || draft.isPending} onClick={() => draft.mutate()}>
              <Sparkles /> {draft.isPending ? "Drafting…" : "Draft assumptions"}
            </Button>
            {drafts.length > 0 && (
              <>
                <ul className="space-y-3 pt-2">
                  {drafts.map((d, i) => (
                    <li key={i} className="rounded-md border bg-background p-3">
                      <Textarea
                        aria-label={`Draft ${i + 1} statement`}
                        value={d.statement}
                        onChange={(e) => setDrafts((all) => all.map((x, j) => (j === i ? { ...x, statement: e.target.value } : x)))}
                        className="min-h-14"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Select
                          aria-label="Type"
                          className="h-8 w-auto text-xs"
                          value={d.type}
                          onChange={(e) => setDrafts((all) => all.map((x, j) => (j === i ? { ...x, type: e.target.value as Draft["type"] } : x)))}
                        >
                          <option value="desirability">Desirability</option>
                          <option value="feasibility">Feasibility</option>
                          <option value="viability">Viability</option>
                        </Select>
                        <span className="text-xs text-muted-foreground">Risk {d.risk}/5</span>
                        <Button size="icon" variant="ghost" className="ml-auto size-8" aria-label="Discard draft" onClick={() => setDrafts((all) => all.filter((_, j) => j !== i))}>
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button disabled={save.isPending} onClick={() => save.mutate(drafts)}>Accept {drafts.length} assumptions</Button>
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
