"use client";
import "@livekit/components-styles";
import { LiveKitRoom, RoomAudioRenderer, VideoConference, useConnectionState, useLocalParticipant, useTracks } from "@livekit/components-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConnectionState, Track } from "livekit-client";
import { ChevronDown, Copy, Loader2, MicOff, PhoneOff, Wand2 } from "lucide-react";
import { MapResults, type IdeaMapResult } from "@/components/idea-map-results";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Brand, PageState, ThemeToggle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Assumption, type Evidence, type LinkRow, type MeetingDetail, type Segment } from "@/lib/api";
import { GUEST_NAME_KEY } from "@/lib/guest";
import { StatusBadge } from "@/lib/status-meta";
import { fmtTime } from "@/lib/utils";
import { useProjectEvents } from "@/lib/use-project-events";

const FRAME_INTERVAL_MS = 20_000;
const FRAME_DIFF_THRESHOLD = 12;

type PipelineState = "idle" | "analyzing" | "error";

const CHUNK_MS = 7_000;
const SILENCE_RMS = 0.012;

/**
 * Records the local mic in short standalone chunks and sends each to the server for
 * cloud speech to text (Gemini API). Silent chunks are skipped on the client.
 */
function Transcriber({ meetingId, name, startedAt }: { meetingId: string; name: string; startedAt: number | null }) {
  const { isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
  const mediaTrack = microphoneTrack?.track?.mediaStreamTrack;
  const [supported, setSupported] = useState(true);
  const [pending, setPending] = useState(0);
  const [sttError, setSttError] = useState<string | null>(null);
  const startRef = useRef(startedAt);
  startRef.current = startedAt;

  useEffect(() => {
    if (!isMicrophoneEnabled || !mediaTrack) return;
    if (typeof MediaRecorder === "undefined") {
      setSupported(false);
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const stream = new MediaStream([mediaTrack.clone()]);
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let active = true;
    let peak = 0;
    const sampler = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      peak = Math.max(peak, Math.sqrt(sum / buf.length));
    }, 100);

    const record = () => {
      if (!active) return;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const parts: Blob[] = [];
      const chunkStart = startRef.current ? (Date.now() - startRef.current) / 1000 : 0;
      peak = 0;
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      rec.onstop = () => {
        const loud = peak >= SILENCE_RMS || ctx.state !== "running";
        if (loud && parts.length) {
          const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
          const fd = new FormData();
          fd.append("audio", blob, "chunk.webm");
          fd.append("speaker", name);
          fd.append("startSec", String(chunkStart));
          setPending((n) => n + 1);
          fetch(`/api/meetings/${meetingId}/transcribe`, { method: "POST", body: fd })
            .then(async (r) => {
              if (r.ok) setSttError(null);
              else setSttError((await r.json().catch(() => null))?.error?.message ?? `HTTP ${r.status}`);
            })
            .catch((e: Error) => setSttError(e.message))
            .finally(() => setPending((n) => n - 1));
        }
        record();
      };
      rec.start();
      setTimeout(() => rec.state === "recording" && rec.stop(), CHUNK_MS);
    };
    record();
    return () => {
      active = false;
      clearInterval(sampler);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    };
  }, [isMicrophoneEnabled, mediaTrack, meetingId, name]);

  return (
    <>
      {!supported && (
        <div className="absolute left-3 top-3 z-10 max-w-xs rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" role="status">
          This browser cannot record audio, so your speech will not be transcribed.
        </div>
      )}
      {supported && !isMicrophoneEnabled && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          <MicOff className="size-3" aria-hidden /> Mic off, not transcribing
        </div>
      )}
      {sttError && (
        <div className="absolute left-3 top-12 z-10 max-w-sm rounded-md border border-destructive/40 bg-card p-2 text-xs text-destructive" role="alert">
          Transcription failed: {sttError}
        </div>
      )}
      {supported && isMicrophoneEnabled && pending > 0 && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3 animate-spin" aria-hidden /> Transcribing
        </div>
      )}
    </>
  );
}

/** When the local user shares their screen, capture frames and upload when they change. */
function FrameCapture({ meetingId, name, startedAt }: { meetingId: string; name: string; startedAt: number | null }) {
  const tracks = useTracks([Track.Source.ScreenShare]);
  const mine = tracks.find((t) => t.participant.isLocal && t.publication?.track);
  const mediaTrack = mine?.publication?.track?.mediaStreamTrack;

  useEffect(() => {
    if (!mediaTrack) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([mediaTrack]);
    video.play().catch(() => {});
    let prev: Uint8ClampedArray | null = null;
    let busy = false;

    const tiny = (): Uint8ClampedArray => {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 32;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(video, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      const g = new Uint8ClampedArray(32 * 32);
      for (let i = 0; i < g.length; i++) g[i] = 0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!;
      return g;
    };

    const tick = async () => {
      if (busy || !video.videoWidth) return;
      busy = true;
      try {
        const cur = tiny();
        if (prev) {
          let sum = 0;
          for (let i = 0; i < cur.length; i++) sum += Math.abs(cur[i]! - prev[i]!);
          if (sum / cur.length <= FRAME_DIFF_THRESHOLD) return;
        }
        prev = cur;
        const scale = Math.min(1, 1280 / video.videoWidth);
        const c = document.createElement("canvas");
        c.width = Math.round(video.videoWidth * scale);
        c.height = Math.round(video.videoHeight * scale);
        c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
        const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.7));
        if (!blob) return;
        const fd = new FormData();
        fd.append("image", blob, "frame.jpg");
        fd.append("sharedBy", name);
        fd.append("startSec", String(startedAt ? (Date.now() - startedAt) / 1000 : 0));
        await fetch(`/api/meetings/${meetingId}/frames`, { method: "POST", body: fd });
      } catch {
      } finally {
        busy = false;
      }
    };
    const first = setTimeout(tick, 2000);
    const id = setInterval(tick, FRAME_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      video.srcObject = null;
    };
  }, [mediaTrack, meetingId, name, startedAt]);

  return null;
}

function RoomBridge({ onState }: { onState: (s: ConnectionState) => void }) {
  const state = useConnectionState();
  useEffect(() => {
    onState(state);
  }, [state, onState]);
  return null;
}

function SidePanel({ detail, pipeline, pipelineMsg, meetingId, projectId }: { detail: MeetingDetail; pipeline: PipelineState; pipelineMsg: string; meetingId: string; projectId: string }) {
  const [interim, setInterim] = useState<{ text: string; name: string } | null>(null);
  const [showQ, setShowQ] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: Event) => setInterim((e as CustomEvent).detail);
    window.addEventListener("al:interim", h);
    return () => window.removeEventListener("al:interim", h);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [detail.segments.length, interim?.text]);

  const q = useQuery({
    queryKey: ["questions", projectId],
    queryFn: () => api<{ assumptionId: string; questions: string[] }[]>(`/projects/${projectId}/questions`),
    enabled: false,
    retry: false,
  });
  const byId = new Map(detail.assumptions.map((a) => [a.id, a]));
  const linksByEv = new Map<string, LinkRow[]>();
  detail.links.forEach((l) => linksByEv.set(l.evidenceId, [...(linksByEv.get(l.evidenceId) ?? []), l]));
  const reprocess = useMutation({ mutationFn: () => api(`/meetings/${meetingId}/reprocess`, { method: "POST" }) });
  const qc = useQueryClient();
  const [suggested, setSuggested] = useState<IdeaMapResult | null>(null);
  const suggest = useMutation({
    mutationFn: () => api<IdeaMapResult>(`/projects/${projectId}/assumptions/map`, { method: "POST", json: { fromCalls: true, stage: "idea" } }),
    onSuccess: setSuggested,
  });

  return (
    <aside className="flex min-h-0 flex-col border-l bg-card">
      <Tabs defaultValue="transcript" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="evidence">Evidence ({detail.evidence.length})</TabsTrigger>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
        </TabsList>
        <TabsContent value="transcript" className="space-y-3 p-3">
          {detail.segments.length === 0 && !interim?.text && <p className="text-sm text-muted-foreground">Waiting for someone to speak. Use Chrome or Edge.</p>}
          {detail.segments.map((s: Segment) => (
            <div key={s.id} className="text-sm">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{s.speaker}</span> · {fmtTime(s.startSec)}
                {!s.processed && <span className="ml-1">· queued</span>}
              </div>
              <p>{s.text}</p>
            </div>
          ))}
          {interim?.text && (
            <p className="text-sm italic text-muted-foreground">
              {interim.name}: {interim.text}
            </p>
          )}
          <div ref={endRef} />
        </TabsContent>
        <TabsContent value="evidence" className="space-y-3 p-3">
          {detail.evidence.length === 0 && <p className="text-sm text-muted-foreground">Evidence appears here about 20 seconds after people speak.</p>}
          {[...detail.evidence].reverse().map((ev: Evidence) => (
            <div key={ev.id} className="rounded-lg border bg-background p-3 text-sm">
              {ev.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.imageUrl} alt="Shared screen frame" className="mb-2 h-20 rounded border object-cover" />
              )}
              {ev.quote ? <blockquote>“{ev.quote}”</blockquote> : <p>{ev.claim}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{ev.speaker}</p>
              <ul className="mt-2 space-y-1">
                {(linksByEv.get(ev.id) ?? []).map((l) => (
                  <li key={l.id} className="text-xs">
                    <span className={l.stance === "supports" ? "text-emerald-600" : l.stance === "contradicts" ? "text-rose-600" : "text-muted-foreground"}>
                      {l.stance === "supports" ? "+ Supports" : l.stance === "contradicts" ? "− Contradicts" : "○ Neutral"}
                    </span>{" "}
                    {byId.get(l.assumptionId)?.statement}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="assumptions" className="space-y-2 p-3">
          <Button size="sm" variant="secondary" className="w-full" disabled={suggest.isPending} onClick={() => suggest.mutate()}>
            <Wand2 /> {suggest.isPending ? "Reading the conversation…" : "Suggest new assumptions from this call"}
          </Button>
          {suggest.error && <p className="text-xs text-destructive" role="alert">{suggest.error.message}</p>}
          {suggested && (
            <div className="rounded-lg border bg-background p-2">
              <MapResults
                key={suggested.testSequence.join()}
                projectId={projectId}
                compact
                result={{ ...suggested, assumptions: suggested.assumptions.filter((a) => a.risk >= 3).slice(0, 8) }}
                onSaved={() => {
                  setSuggested(null);
                  qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
                }}
              />
            </div>
          )}
          {detail.assumptions.map((a: Assumption) => (
            <div key={a.id} className="rounded-lg border bg-background p-2.5 text-sm">
              <p className="leading-snug">{a.statement}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge status={a.status} />
                <span className="text-xs text-muted-foreground">{Math.round(a.confidence * 100)}%</span>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
      <div className="border-t">
        <button
          className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
          aria-expanded={showQ}
          onClick={() => {
            setShowQ((v) => !v);
            if (!q.data && !q.isFetching) q.refetch();
          }}
        >
          Questions to ask <ChevronDown className={`size-4 transition ${showQ ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {showQ && (
          <div className="max-h-52 space-y-3 overflow-y-auto px-3 pb-3 text-sm">
            {q.isFetching && <p className="text-muted-foreground">Thinking…</p>}
            {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
            {q.data?.map((i) => (
              <div key={i.assumptionId}>
                <p className="text-xs text-muted-foreground">{byId.get(i.assumptionId)?.statement}</p>
                <ul className="list-disc pl-5">{i.questions.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </div>
      {pipeline === "error" && (
        <div className="flex items-center gap-2 border-t bg-destructive/5 p-2 text-xs text-destructive" role="alert">
          <span className="flex-1">Analysis failed: {pipelineMsg}</span>
          <Button size="sm" variant="outline" onClick={() => reprocess.mutate()}>Retry</Button>
        </div>
      )}
    </aside>
  );
}

export default function CallPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const key = ["meeting", meetingId];
  const [name, setName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lkState, setLkState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [pipeline, setPipeline] = useState<PipelineState>("idle");
  const [pipelineMsg, setPipelineMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const started = useRef(false);

  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<MeetingDetail>(`/meetings/${meetingId}`) });
  const projectId = data?.meeting.projectId;

  useEffect(() => {
    try {
      const n = localStorage.getItem(GUEST_NAME_KEY);
      if (n) setName(n);
    } catch {}
  }, []);
  useEffect(() => {
    if (data?.meeting.startedAt && !startedAt) setStartedAt(new Date(data.meeting.startedAt).getTime());
    if (data?.meeting.state === "ended") router.replace(`/m/${meetingId}/review`);
  }, [data?.meeting.startedAt, data?.meeting.state, startedAt, router, meetingId]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!name) return;
    api<{ token: string; url: string }>("/livekit/token", { method: "POST", json: { meetingId, name } })
      .then(setConn)
      .catch((e: Error) => setConnError(e.message));
  }, [name, meetingId]);

  const onState = useCallback(
    (s: ConnectionState) => {
      setLkState(s);
      if (s === ConnectionState.Connected && !started.current) {
        started.current = true;
        api<{ startedAt: string }>(`/meetings/${meetingId}/start`, { method: "POST" })
          .then((r) => setStartedAt(new Date(r.startedAt).getTime()))
          .catch(() => {});
      }
    },
    [meetingId],
  );

  const connected = useProjectEvents(projectId, (ev, d) => {
    if (d.meetingId && d.meetingId !== meetingId && ev !== "assumption.updated") return;
    if (ev === "segment.added") {
      qc.setQueryData<MeetingDetail>(key, (old) =>
        old && !old.segments.some((s) => s.id === d.segment.id) ? { ...old, segments: [...old.segments, d.segment] } : old,
      );
    } else if (ev === "evidence.added") {
      qc.setQueryData<MeetingDetail>(key, (old) =>
        old && !old.evidence.some((e) => e.id === d.evidence.id)
          ? {
              ...old,
              evidence: [...old.evidence, d.evidence],
              links: [...old.links, ...(d.links ?? [])],
              segments: d.segment ? old.segments.map((s) => (s.id === d.segment.id ? { ...s, processed: true } : s)) : old.segments,
            }
          : old,
      );
    } else if (ev === "assumption.updated" && d.assumption) {
      qc.setQueryData<MeetingDetail>(key, (old) =>
        old ? { ...old, assumptions: old.assumptions.map((a) => (a.id === d.assumption.id ? d.assumption : a)) } : old,
      );
    } else if (ev === "pipeline.state") {
      setPipeline(d.state === "analyzing" ? "analyzing" : "idle");
      if (d.state === "idle") qc.invalidateQueries({ queryKey: key });
    } else if (ev === "pipeline.error") {
      setPipeline("error");
      setPipelineMsg(String(d.message ?? ""));
    } else if (ev === "meeting.ended") {
      router.replace(`/m/${meetingId}/review`);
    }
  });

  const end = useMutation({
    mutationFn: () => api(`/meetings/${meetingId}/end`, { method: "POST" }),
    onSuccess: () => router.replace(`/m/${meetingId}/review`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || error || !data) return <PageState loading={isLoading} error={error?.message} />;

  if (!name) {
    return (
      <main className="mx-auto max-w-md px-4 py-20">
        <form
          className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const n = draftName.trim();
            try {
              localStorage.setItem(GUEST_NAME_KEY, n);
            } catch {}
            setName(n);
          }}
        >
          <h1 className="text-lg font-semibold">{data.meeting.title}</h1>
          <div>
            <Label htmlFor="nm">Your name</Label>
            <Input id="nm" value={draftName} onChange={(e) => setDraftName(e.target.value)} required maxLength={60} autoFocus />
          </div>
          <Button type="submit" className="w-full" disabled={!draftName.trim()}>Join call</Button>
        </form>
      </main>
    );
  }

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${data.meeting.inviteCode}` : "";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Brand />
        <span className="hidden truncate text-sm text-muted-foreground sm:block">/ {data.meeting.title}</span>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="tabular-nums font-medium" aria-label="Meeting timer">{fmtTime(elapsed)}</span>
          <span className="flex items-center gap-1" role="status">
            <span className={`size-2 rounded-full ${lkState === ConnectionState.Connected ? "bg-emerald-500" : "bg-amber-500"}`} />
            {lkState === ConnectionState.Connected ? "Connected" : lkState === ConnectionState.Connecting ? "Connecting" : lkState}
          </span>
          <span className="flex items-center gap-1" role="status">
            {pipeline === "analyzing" ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <span className={`size-2 rounded-full ${pipeline === "error" ? "bg-destructive" : "bg-slate-400"}`} />}
            {pipeline === "analyzing" ? "Analyzing" : pipeline === "error" ? "Pipeline error" : "Idle"}
          </span>
          {!connected && <span className="text-amber-600">Live updates reconnecting</span>}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              toast.success("Invite link copied");
            }}
          >
            <Copy /> Invite
          </Button>
          <Button size="sm" variant="destructive" disabled={end.isPending} onClick={() => end.mutate()}>
            <PhoneOff /> {end.isPending ? "Ending…" : "End call"}
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[2fr_1fr]">
        <div className="relative min-h-0" data-lk-theme="default">
          {connError && <div className="m-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive" role="alert">{connError}</div>}
          {!conn && !connError && <PageState loading />}
          {conn && (
            <LiveKitRoom token={conn.token} serverUrl={conn.url} connect video audio className="h-full" onDisconnected={() => setLkState(ConnectionState.Disconnected)}>
              <RoomBridge onState={onState} />
              <VideoConference />
              <RoomAudioRenderer />
              <Transcriber meetingId={meetingId} name={name} startedAt={startedAt} />
              <FrameCapture meetingId={meetingId} name={name} startedAt={startedAt} />
            </LiveKitRoom>
          )}
        </div>
        {projectId && <SidePanel detail={data} pipeline={pipeline} pipelineMsg={pipelineMsg} meetingId={meetingId} projectId={projectId} />}
      </div>
      <Link href={`/p/${data.meeting.projectId}/meetings`} className="sr-only">Back to meetings</Link>
    </div>
  );
}
