"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FileText, Radio } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { NewMeetingDialog } from "@/components/meeting-dialogs";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { api, type Meeting } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { useProjectEvents } from "@/lib/use-project-events";

const STATE_STYLE = {
  scheduled: "bg-muted text-foreground",
  live: "bg-border text-foreground",
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
  return (
    <RequireAuth>
      <Meetings />
    </RequireAuth>
  );
}

function Meetings() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const key = ["meetings", projectId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<Meeting[]>(`/projects/${projectId}/meetings`) });
  useProjectEvents(projectId, (ev) => {
    if (ev === "meeting.updated" || ev === "meeting.ended") qc.invalidateQueries({ queryKey: key });
  });

  return (
    <>
      <main className="max-w-4xl">
        <ProjectHeader projectId={projectId}>
          <NewMeetingDialog projectId={projectId} />
          <NewMeetingDialog projectId={projectId} goLive />
        </ProjectHeader>
        <PageState loading={isLoading} error={error?.message} />
        {data?.length === 0 && (
          <section className="rounded-lg border border-dashed bg-card px-6 py-10">
            <h2 className="text-base font-semibold">No meetings yet</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Start a live call to talk to a customer now, or schedule one and send the invite link. The transcript is written as people speak and feeds the evidence.
            </p>
          </section>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y divide-rule overflow-hidden rounded-lg border bg-card">
            {data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-medium">{m.title}</h2>
                    <span className={`inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium ${STATE_STYLE[m.state]}`}>
                      {m.state === "live" && <span className="size-1.5 rounded-full bg-destructive" aria-hidden />}
                      {m.state[0]!.toUpperCase() + m.state.slice(1)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {m.scheduledFor ? `Scheduled ${new Date(m.scheduledFor).toLocaleString()}` : m.heldAt ? `Held ${m.heldAt}` : "Not scheduled"}
                    {m.participants.length ? ` · ${m.participants.join(", ")}` : ""}
                  </p>
                </div>
                {m.state !== "ended" && <CopyInvite code={m.inviteCode} />}
                {m.state !== "ended" ? (
                  <Button size="sm" asChild>
                    <Link href={`/m/${m.id}/call`}>
                      <Radio /> {m.state === "live" ? "Rejoin" : "Start"}
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/m/${m.id}/call`}>
                      <FileText /> Transcript
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
