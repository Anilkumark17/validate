"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { api, type Meeting } from "@/lib/api";

interface InsightRow {
  id: string;
  status: "ai_suggested" | "confirmed" | "rejected";
  segmentIds: string[];
  quoteEn: string;
  summaryEn: string;
  kind: string;
  evidenceType: string;
  importance: number;
  confidence: number;
  ledByInterviewer: boolean;
  rejectReason: string | null;
}

interface Summary {
  headline: string;
  context: string;
  key_takeaways: { text: string; insight_ids: string[] }[];
  surprises: string[];
  open_questions: string[];
  decisions?: string[];
  action_items?: string[];
  risks?: string[];
  interview_quality: { led_count: number; hypothetical_count: number; note: string };
}

interface Payload {
  insights: InsightRow[];
  run: { status: string; error: string | null } | null;
  summary: Summary | null;
}

function SummaryList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Meeting notes from the latest extract. */
export function MeetingNotes({ summary }: { summary: Summary }) {
  return (
    <section>
      <h2 className="text-base font-semibold">{summary.headline}</h2>
      {summary.context && <p className="mt-1 text-sm text-muted-foreground">{summary.context}</p>}
      {summary.key_takeaways.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {summary.key_takeaways.map((item) => (
            <li key={item.text}>{item.text}</li>
          ))}
        </ul>
      )}
      <SummaryList title="Decisions" items={summary.decisions} />
      <SummaryList title="Action items" items={summary.action_items} />
      <SummaryList title="Risks" items={summary.risks} />
      {summary.surprises.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-medium">Surprises. </span>
          {summary.surprises.join(" ")}
        </p>
      )}
      {summary.open_questions.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium">Open questions</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {summary.open_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      {summary.interview_quality?.note && <p className="mt-3 text-xs text-muted-foreground">{summary.interview_quality.note}</p>}
    </section>
  );
}

/** Extract lives on the transcript page. The meeting list does not start a run. */
export function TranscriptExtract({ meeting }: { meeting: Meeting }) {
  const qc = useQueryClient();
  const [consented, setConsented] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const key = ["insights", meeting.id];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api<Payload>(`/meetings/${meeting.id}/insights`),
    refetchInterval: (q) => {
      const status = q.state.data?.run?.status;
      return status === "pending" || status === "running" ? 3000 : false;
    },
  });
  const extract = useMutation({
    mutationFn: async () => {
      if (!meeting.consentAt) {
        await api(`/meetings/${meeting.id}/consent`, { method: "PUT", json: { consent: true } });
        qc.invalidateQueries({ queryKey: ["meetings", meeting.projectId] });
        qc.invalidateQueries({ queryKey: ["meeting", meeting.id] });
      }
      return api(`/meetings/${meeting.id}/extract`, { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Extracting insights");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const review = useMutation({
    mutationFn: (body: { id: string; action: "confirm" | "reject"; reason?: string }) =>
      api(`/meetings/${meeting.id}/insights/${body.id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      setReasonFor(null);
      setReason("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const running = data?.run?.status === "pending" || data?.run?.status === "running" || extract.isPending;
  const points = (data?.insights ?? []).filter((item) => item.status !== "rejected");
  const summary = data?.summary;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {!meeting.consentAt && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 rounded-sm border border-input" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
            Customer consented
          </label>
        )}
        <Button size="sm" disabled={running || (!meeting.consentAt && !consented)} onClick={() => extract.mutate()}>
          <Sparkles /> {running ? "Extracting…" : "Extract"}
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {data?.run?.status === "failed" && data.run.error && <p className="text-sm text-destructive">{data.run.error}</p>}
        {running && <p className="text-sm text-muted-foreground">Reading the transcript. The summary and insights appear here when the run finishes.</p>}
        {summary?.headline && <MeetingNotes summary={summary} />}
        {points.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Insights</h3>
            <ul className="space-y-3">
              {points.map((item) => (
                <li key={item.id} className="rounded-lg border bg-card p-3 text-sm">
                  <p>{item.summaryEn}</p>
                  <p className="mt-1 text-muted-foreground">“{item.quoteEn}”</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.kind} · {item.evidenceType} · importance {item.importance}
                    {item.ledByInterviewer ? " · led by interviewer" : ""}
                    {item.status === "confirmed" ? " · confirmed" : ""}
                  </p>
                  <span className="mt-2 flex flex-wrap items-center gap-3">
                    {item.segmentIds[0] && (
                      <Link href={`#seg-${item.segmentIds[0]}`} className="text-xs underline">
                        Transcript
                      </Link>
                    )}
                    {item.status !== "confirmed" && (
                      <button type="button" className="text-xs underline" disabled={review.isPending} onClick={() => review.mutate({ id: item.id, action: "confirm" })}>
                        Confirm
                      </button>
                    )}
                    <button type="button" className="text-xs underline" onClick={() => setReasonFor(reasonFor === item.id ? null : item.id)}>
                      Reject
                    </button>
                  </span>
                  {reasonFor === item.id && (
                    <span className="mt-2 flex flex-wrap gap-2">
                      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="One-line reason" className="h-8 w-56" />
                      <Button size="sm" variant="destructive" disabled={!reason.trim() || review.isPending} onClick={() => review.mutate({ id: item.id, action: "reject", reason: reason.trim() })}>
                        Reject
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {data && !running && !summary?.headline && points.length === 0 && <p className="text-sm text-muted-foreground">No extract yet. Extract reads this transcript and writes the summary and insights here.</p>}
      </div>
    </div>
  );
}
