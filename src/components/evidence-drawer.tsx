"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ImageIcon, Quote, Undo2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/form";
import { api, type Assumption, type StatusEvent } from "@/lib/api";
import { StatusBadge, TYPE_LABEL } from "@/lib/status-meta";
import { fmtTime, timeAgo } from "@/lib/utils";

interface EvLink {
  id: string;
  stance: "supports" | "contradicts" | "neutral";
  strength: number;
  rationale: string | null;
  origin: "model" | "user";
  rejected: boolean;
  claim: string;
  quote: string | null;
  speaker: string | null;
  imageUrl: string | null;
  startSec: number | null;
  meetingId: string;
  meetingTitle: string;
}

const GROUPS: { stance: EvLink["stance"]; title: string }[] = [
  { stance: "supports", title: "Supports" },
  { stance: "contradicts", title: "Contradicts" },
  { stance: "neutral", title: "Neutral" },
];

export function EvidenceDrawer({ assumption, onClose }: { assumption: Assumption | null; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["evidence", assumption?.id];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    enabled: !!assumption,
    queryFn: () => api<{ assumption: Assumption; links: EvLink[]; history: StatusEvent[] }>(`/assumptions/${assumption!.id}/evidence`),
    refetchInterval: 8000,
  });
  const patch = useMutation({
    mutationFn: ({ id, ...v }: { id: string; stance?: string; strength?: number; rejected?: boolean }) =>
      api(`/links/${id}`, { method: "PATCH", json: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <Dialog open={!!assumption} onOpenChange={(o) => !o && onClose()}>
      {assumption && (
        <DialogContent side="right" title={assumption.statement}>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={assumption.status} />
            <span className="rounded-full bg-muted px-2 py-0.5">{TYPE_LABEL[assumption.type]}</span>
            <span className="text-muted-foreground">Risk {assumption.risk}/5</span>
            <span className="text-muted-foreground">Confidence {Math.round(assumption.confidence * 100)}%</span>
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Loading evidence…</p>}
          {error && <p className="text-sm text-destructive" role="alert">{error.message}</p>}
          {data && data.links.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No evidence yet. Run an interview or import a transcript.
            </p>
          )}
          {data &&
            GROUPS.map((g) => {
              const items = data.links.filter((l) => l.stance === g.stance);
              if (!items.length) return null;
              return (
                <section key={g.stance} className="mb-6">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.title} ({items.length})
                  </h3>
                  <ul className="space-y-3">
                    {items.map((l) => (
                      <li key={l.id} className={`rounded-lg border bg-background p-3 ${l.rejected ? "opacity-50" : ""}`}>
                        {l.imageUrl ? (
                          <a href={l.imageUrl} target="_blank" rel="noreferrer" className="mb-2 block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={l.imageUrl} alt="Screen capture evidence" className="h-24 rounded-md border object-cover" />
                          </a>
                        ) : null}
                        {l.quote ? (
                          <blockquote className="flex gap-2 text-sm">
                            <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span>“{l.quote}”</span>
                          </blockquote>
                        ) : (
                          <p className="flex gap-2 text-sm">
                            <ImageIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            {l.claim}
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {l.speaker ?? "Unknown"}
                          {l.startSec != null ? ` at ${fmtTime(l.startSec)}` : ""} in{" "}
                          <Link href={`/m/${l.meetingId}/review`} className="underline underline-offset-2 hover:text-foreground">
                            {l.meetingTitle}
                          </Link>
                          {l.origin === "user" ? " · edited by you" : ""}
                        </p>
                        {l.rationale ? <p className="mt-1 text-xs italic text-muted-foreground">{l.rationale}</p> : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Select
                            aria-label="Stance"
                            className="h-8 w-auto text-xs"
                            value={l.stance}
                            onChange={(e) => patch.mutate({ id: l.id, stance: e.target.value })}
                          >
                            <option value="supports">Supports</option>
                            <option value="contradicts">Contradicts</option>
                            <option value="neutral">Neutral</option>
                          </Select>
                          <Select
                            aria-label="Strength"
                            className="h-8 w-auto text-xs"
                            value={l.strength}
                            onChange={(e) => patch.mutate({ id: l.id, strength: Number(e.target.value) })}
                          >
                            <option value={1}>Weak (1)</option>
                            <option value={2}>Moderate (2)</option>
                            <option value={3}>Strong (3)</option>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => patch.mutate({ id: l.id, rejected: !l.rejected })}
                          >
                            {l.rejected ? <Undo2 /> : <Ban />} {l.rejected ? "Restore" : "Reject"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          {data && data.history.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status history</h3>
              <ol className="space-y-3 border-l pl-4">
                {data.history.map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {h.fromStatus ? <StatusBadge status={h.fromStatus} /> : null}
                      <span aria-hidden className="text-muted-foreground">to</span>
                      <StatusBadge status={h.toStatus} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {h.reason} · {timeAgo(h.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
