"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageState, TopBar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { api, type MeetingDetail } from "@/lib/api";
import { StatusBadge } from "@/lib/status-meta";
import { fmtTime } from "@/lib/utils";
import { useProjectEvents } from "@/lib/use-project-events";

function toMarkdown(d: MeetingDetail) {
  const byId = new Map(d.assumptions.map((a) => [a.id, a]));
  const lines: string[] = [`# ${d.meeting.title}`, "", `Project: ${d.project.name}`, `Held: ${d.meeting.heldAt ?? "n/a"}`, ""];
  lines.push("## Status changes", "");
  if (d.events.length === 0) lines.push("No status changes.");
  for (const e of d.events) {
    lines.push(`- ${byId.get(e.assumptionId)?.statement ?? e.assumptionId}: ${e.fromStatus ?? "none"} to ${e.toStatus} (${e.reason ?? ""})`);
  }
  lines.push("", "## Evidence", "");
  for (const ev of d.evidence) {
    const seg = d.segments.find((s) => s.id === ev.segmentId);
    lines.push(ev.quote ? `> "${ev.quote}"` : `- ${ev.claim} (image)`);
    lines.push(`> ${ev.speaker ?? "Unknown"}${seg?.startSec != null ? ` at ${fmtTime(seg.startSec)}` : ""}`, "");
    for (const l of d.links.filter((x) => x.evidenceId === ev.id)) {
      lines.push(`- ${l.rejected ? "(rejected) " : ""}${l.stance} (strength ${l.strength}): ${byId.get(l.assumptionId)?.statement}`);
    }
    lines.push("");
  }
  lines.push("## Usage", "", `Model calls: ${d.meeting.modelCalls}`, `Input tokens: ${d.meeting.inputTokens}`, `Output tokens: ${d.meeting.outputTokens}`);
  return lines.join("\n");
}

export default function ReviewPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const qc = useQueryClient();
  const key = ["meeting", meetingId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<MeetingDetail>(`/meetings/${meetingId}`), refetchInterval: (q) => (q.state.data?.meeting.jobStatus === "processing" || q.state.data?.meeting.jobStatus === "queued" ? 3000 : false) });
  useProjectEvents(data?.meeting.projectId, (ev) => {
    if (ev === "pipeline.state" || ev === "evidence.added" || ev === "assumption.updated" || ev === "pipeline.error") qc.invalidateQueries({ queryKey: key });
  });
  const patch = useMutation({
    mutationFn: ({ id, rejected }: { id: string; rejected: boolean }) => api(`/links/${id}`, { method: "PATCH", json: { rejected } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const reprocess = useMutation({
    mutationFn: () => api(`/meetings/${meetingId}/reprocess`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (isLoading || error || !data) return <><TopBar /><PageState loading={isLoading} error={error?.message} /></>;
  const { meeting, project } = data;
  const byId = new Map(data.assumptions.map((a) => [a.id, a]));
  const unprocessed = data.segments.filter((s) => !s.processed).length;

  return (
    <>
      <TopBar crumbs={<><Link href={`/p/${project.id}`} className="hover:underline">{project.name}</Link><span aria-hidden>/</span><span className="truncate text-foreground">{meeting.title}</span></>}>
        <Button
          variant="outline"
          onClick={() => {
            const blob = new Blob([toMarkdown(data)], { type: "text/markdown" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${meeting.title.replace(/[^\w]+/g, "-").toLowerCase()}.md`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          <Download /> Export Markdown
        </Button>
      </TopBar>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            {data.segments.length} transcript lines · {data.evidence.length} evidence items · {meeting.modelCalls} model calls ·{" "}
            {meeting.inputTokens.toLocaleString()} in / {meeting.outputTokens.toLocaleString()} out tokens
          </p>
          {(meeting.jobStatus === "processing" || meeting.jobStatus === "queued") && unprocessed > 0 && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">Analyzing {unprocessed} lines…</p>
          )}
          {(meeting.jobStatus === "failed" || (meeting.jobStatus === "done" && unprocessed > 0)) && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              <span className="flex-1">{meeting.jobError ?? "Some lines were not analyzed."}</span>
              <Button size="sm" variant="outline" disabled={reprocess.isPending} onClick={() => reprocess.mutate()}>
                <RotateCw /> Reprocess
              </Button>
            </div>
          )}
        </div>

        <section aria-labelledby="changes">
          <h2 id="changes" className="mb-3 text-lg font-semibold">What changed</h2>
          {data.events.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No status transitions from this meeting.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {data.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="min-w-0 flex-1">{byId.get(e.assumptionId)?.statement}</span>
                  {e.fromStatus && <StatusBadge status={e.fromStatus} />}
                  <span aria-hidden className="text-muted-foreground">to</span>
                  <StatusBadge status={e.toStatus} />
                  <span className="w-full text-xs text-muted-foreground">{e.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ev">
          <h2 id="ev" className="mb-3 text-lg font-semibold">Evidence</h2>
          {data.evidence.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No evidence extracted yet.</p>}
          <ul className="space-y-3">
            {data.evidence.map((ev) => {
              const seg = data.segments.find((s) => s.id === ev.segmentId);
              const links = data.links.filter((l) => l.evidenceId === ev.id);
              return (
                <li key={ev.id} className="rounded-lg border bg-card p-4">
                  {ev.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.imageUrl} alt="Screen share evidence" className="mb-2 max-h-40 rounded border" />
                  )}
                  {ev.quote ? <blockquote className="text-sm">“{ev.quote}”</blockquote> : <p className="text-sm">{ev.claim}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ev.speaker ?? "Unknown"}{seg?.startSec != null ? ` at ${fmtTime(seg.startSec)}` : ""}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {links.map((l) => (
                      <li key={l.id} className={`flex flex-wrap items-center gap-2 text-sm ${l.rejected ? "opacity-50 line-through" : ""}`}>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${l.stance === "supports" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : l.stance === "contradicts" ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-muted"}`}>
                          {l.stance} · {l.strength}
                        </span>
                        <span className="min-w-0 flex-1">{byId.get(l.assumptionId)?.statement}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={l.rejected ? "Accept link" : "Reject link"}
                          onClick={() => patch.mutate({ id: l.id, rejected: !l.rejected })}
                        >
                          {l.rejected ? <><Check /> Accept</> : <><X /> Reject</>}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </>
  );
}
