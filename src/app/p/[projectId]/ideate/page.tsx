"use client";
import { useMutation } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { IdeaMapResult, MapResults } from "@/components/idea-map-results";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";

export default function IdeatePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [customer, setCustomer] = useState("");
  const [stage, setStage] = useState("idea");
  const [known, setKnown] = useState("");
  const [constraints, setConstraints] = useState("");
  const [fromCalls, setFromCalls] = useState(false);
  const [result, setResult] = useState<IdeaMapResult | null>(null);

  const map = useMutation({
    mutationFn: () =>
      api<IdeaMapResult>(`/projects/${projectId}/assumptions/map`, {
        method: "POST",
        json: { idea: idea || undefined, customer: customer || undefined, stage, known: known || undefined, constraints: constraints || undefined, fromCalls },
      }),
    onSuccess: setResult,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <ProjectHeader projectId={projectId} />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[380px_1fr]">
        <form
          className="space-y-4 self-start rounded-lg border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            map.mutate();
          }}
        >
          <div>
            <h1 className="text-lg font-semibold">Map an idea</h1>
            <p className="text-sm text-muted-foreground">Find what has to be true, rank by risk, and get the cheapest test for each.</p>
          </div>
          <div>
            <Label htmlFor="idea">Idea</Label>
            <Textarea id="idea" rows={4} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Leave empty to use the project name and description." />
          </div>
          <div>
            <Label htmlFor="cust">Customer</Label>
            <Input id="cust" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Working parents with kids under 10" />
          </div>
          <div>
            <Label htmlFor="stage">Stage</Label>
            <Select id="stage" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="idea">Idea, nothing built</option>
              <option value="prototype">Prototype</option>
              <option value="live">Live</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="known">What I already know</Label>
            <Textarea id="known" rows={3} value={known} onChange={(e) => setKnown(e.target.value)} placeholder="Interviews done, numbers, anything observed" />
          </div>
          <div>
            <Label htmlFor="cons">Constraints</Label>
            <Input id="cons" value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="Budget, time, team size" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={fromCalls} onChange={(e) => setFromCalls(e.target.checked)} />
            Use call transcripts as evidence
          </label>
          <Button type="submit" className="w-full" disabled={map.isPending}>
            <Wand2 /> {map.isPending ? "Mapping, this can take a minute…" : "Map assumptions"}
          </Button>
        </form>
        <section aria-live="polite">
          {!result && !map.isPending && (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Your ranked assumptions appear here. Pick the ones to track and add them to the board.
            </div>
          )}
          {result && <MapResults key={JSON.stringify(result.testSequence)} projectId={projectId} result={result} onSaved={() => router.push(`/p/${projectId}`)} />}
        </section>
      </main>
    </>
  );
}
