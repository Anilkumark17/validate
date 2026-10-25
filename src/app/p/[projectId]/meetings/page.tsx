"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FileText, Link2, Radio } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { ImportDialog, NewMeetingDialog } from "@/components/meeting-dialogs";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { api, type Meeting } from "@/lib/api";
import { useProjectEvents } from "@/lib/use-project-events";

const STATE_STYLE = {
  scheduled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  live: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  ended: "bg-muted text-muted-foreground",
} as const;

function CopyInvite({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
        setDone(true);
        toast.success("Invite link copied");
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check /> : <Copy />} Copy invite
    </Button>
  );
}

export default function MeetingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const key = ["meetings", projectId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<Meeting[]>(`/projects/${projectId}/meetings`) });
  useProjectEvents(projectId, (ev) => {
    if (ev === "meeting.updated" || ev === "meeting.ended" || ev === "pipeline.state") qc.invalidateQueries({ queryKey: key });
  });

  return (
    <>
      <ProjectHeader projectId={projectId}>
        <ImportDialog projectId={projectId} />
        <NewMeetingDialog projectId={projectId} />
        <NewMeetingDialog projectId={projectId} goLive />
      </ProjectHeader>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold">Meetings</h1>
        <p className="mb-6 text-sm text-muted-foreground">Schedule interviews, share an invite link, and review what each one proved.</p>
        <PageState loading={isLoading} error={error?.message} empty={data?.length === 0} emptyText="No meetings yet. Schedule one or import a transcript." />
        <ul className="space-y-3">
          {data?.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-medium">{m.title}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLE[m.state]}`}>
                    {m.state === "live" ? "● Live" : m.state[0]!.toUpperCase() + m.state.slice(1)}
                  </span>
                  {m.source === "transcript_upload" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Imported</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.scheduledFor ? `Scheduled ${new Date(m.scheduledFor).toLocaleString()}` : m.heldAt ? `Held ${m.heldAt}` : "Not scheduled"}
                  {m.participants.length ? ` · ${m.participants.join(", ")}` : ""}
                  {m.jobStatus === "failed" ? " · analysis failed" : m.jobStatus === "processing" ? " · analyzing…" : ""}
                </p>
              </div>
              {m.state !== "ended" && <CopyInvite code={m.inviteCode} />}
              {m.state !== "ended" && (
                <Button size="sm" asChild>
                  <Link href={`/m/${m.id}/call`}>
                    <Radio /> {m.state === "live" ? "Rejoin" : "Start"}
                  </Link>
                </Button>
              )}
              {m.state === "ended" && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/m/${m.id}/review`}>
                    <FileText /> Review
                  </Link>
                </Button>
              )}
              <Link2 className="hidden" aria-hidden />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
