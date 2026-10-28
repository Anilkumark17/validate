"use client";
import "@livekit/components-styles";
import { LiveKitRoom, RoomAudioRenderer, VideoConference, useConnectionState, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConnectionState, RoomEvent } from "livekit-client";
import { Copy, MicOff, PhoneOff } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Brand, PageState, ThemeToggle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { api, ApiRequestError, type MeetingDetail, type Segment } from "@/lib/api";
import { GUEST_NAME_KEY } from "@/lib/guest";
import { useMe } from "@/lib/auth";
import { DEFAULT_ENDPOINTER, Endpointer } from "@/lib/audio/endpointer";
import { Window } from "@/lib/audio/metrics";
import { UploadQueue } from "@/lib/audio/upload-queue";
import { encodeWav } from "@/lib/audio/wav";
import { insertSegment } from "@/lib/transcript";
import { fmtTime } from "@/lib/utils";
import { useProjectEvents } from "@/lib/use-project-events";

/** Rolling end to end latency (final result in the speaker's browser -> shown here). Shown by ?debug=1. */
const lat = { e2e: new Window() };

interface SpeechAlt {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlt;
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognizerCtor = new () => Recognizer;

function recognizerCtor(): RecognizerCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface Interim {
  speaker: string;
  text: string;
}

const CAPTURE_WORKLET = `
class Cap extends AudioWorkletProcessor {
  constructor() { super(); this.b = new Float32Array(1600); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let k = 0; k < ch.length; k++) {
      this.b[this.n++] = ch[k];
      if (this.n === 1600) { this.port.postMessage(this.b.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("cap", Cap);
`;

type Mode = "sarvam" | "browser";
/** Chunks that fail this many times in a row switch the speaker to the browser's speech recognition. */
const FAILS_BEFORE_FALLBACK = 2;
/** After a fallback, try Sarvam again once this much time has passed. */
const FALLBACK_COOLDOWN_MS = 120_000;

/**
 * Speech to text for the local mic. First choice: Sarvam, through the server (continuous 16 kHz capture,
 * cut at pauses, uploaded through a bounded queue). If Sarvam is not configured, rejects the key, or
 * keeps failing, this switches to the browser's Web Speech API and retries Sarvam after a cooldown.
 * Final phrases from either path are saved by the server and broadcast over LiveKit. Interim text
 * (browser mode only) goes over the LiveKit data channel for display and is never stored.
 */
function Transcriber({
  meetingId,
  name,
  startedAt,
  onSegment,
}: {
  meetingId: string;
  name: string;
  startedAt: number | null;
  onSegment: (s: Segment) => void;
}) {
  const room = useRoomContext();
  const { isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
  const mediaTrack = microphoneTrack?.track?.mediaStreamTrack;
  const [mode, setMode] = useState<Mode>("sarvam");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const startRef = useRef(startedAt);
  startRef.current = startedAt;
  const segRef = useRef(onSegment);
  segRef.current = onSegment;
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fallback = useCallback((reason: string) => {
    setMode("browser");
    setNotice(reason);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      failures.current = 0;
      setNotice(null);
      setMode("sarvam");
    }, FALLBACK_COOLDOWN_MS);
  }, []);
  useEffect(() => () => void (retryTimer.current && clearTimeout(retryTimer.current)), []);

  // ---- Sarvam (first priority) ----
  useEffect(() => {
    if (mode !== "sarvam" || !isMicrophoneEnabled || !mediaTrack) return;
    if (typeof AudioWorkletNode === "undefined") {
      setTimeout(() => fallback("This browser cannot capture raw audio"), 0);
      return;
    }
    let active = true;
    const stream = new MediaStream([mediaTrack.clone()]);
    const ctx = new AudioContext({ sampleRate: 16_000 });
    const rate = ctx.sampleRate;
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }));
    const ep = new Endpointer({ ...DEFAULT_ENDPOINTER, sampleRate: rate });
    let wallStart = 0;
    let seq = 0;

    const queue = new UploadQueue({
      maxPending: 4,
      maxAttempts: 3,
      maxMergedSec: 28,
      sampleRate: rate,
      onFailed: () => {
        failures.current++;
        if (failures.current >= FAILS_BEFORE_FALLBACK) fallback("Sarvam is not responding, using browser speech recognition");
      },
      send: async (c) => {
        const fd = new FormData();
        fd.append("audio", new Blob([encodeWav(c.samples, rate)], { type: "audio/wav" }), "chunk.wav");
        fd.append("speaker", name);
        fd.append("clientId", c.chunkId);
        fd.append("startSec", String(c.startSec));
        fd.append("capturedAt", String(c.capturedAt));
        try {
          const r = await fetch(`/api/meetings/${meetingId}/transcribe`, { method: "POST", body: fd });
          if (r.ok) {
            failures.current = 0;
            setError(null);
            const j = (await r.json().catch(() => null)) as { segment?: Segment | null } | null;
            if (j?.segment) segRef.current(j.segment);
            return { ok: true };
          }
          const body = (await r.json().catch(() => null)) as { error?: { code?: string; message?: string; fatal?: boolean } } | null;
          const err = body?.error;
          if (err?.code === "stt_unavailable") {
            if (err.fatal) {
              fallback(err.message?.includes("not configured") ? "Sarvam is not configured, using browser speech recognition" : "Sarvam rejected the request, using browser speech recognition");
              return { ok: false, retryable: false };
            }
            return { ok: false, retryable: true };
          }
          // Our own errors (ended meeting, bad request, no access) are not Sarvam failures.
          setError(err?.message ?? `HTTP ${r.status}`);
          return { ok: false, retryable: r.status >= 500 };
        } catch (e) {
          setError((e as Error).message);
          return { ok: false, retryable: true };
        }
      },
    });

    const submit = (chunk: ReturnType<Endpointer["push"]>) => {
      if (!chunk) return;
      const rel = startRef.current ? (wallStart + chunk.startMs - startRef.current) / 1000 : 0;
      queue.push({
        chunkId: crypto.randomUUID(),
        seq: seq++,
        samples: chunk.samples,
        startSec: Math.max(0, rel),
        capturedAt: wallStart + chunk.startMs + chunk.durationMs,
        enqueuedAt: Date.now(),
      });
    };

    let node: AudioWorkletNode | null = null;
    void (async () => {
      try {
        await ctx.resume();
        await ctx.audioWorklet.addModule(url);
        if (!active) return;
        const src = ctx.createMediaStreamSource(stream);
        node = new AudioWorkletNode(ctx, "cap");
        const mute = ctx.createGain();
        mute.gain.value = 0;
        src.connect(node);
        node.connect(mute).connect(ctx.destination);
        wallStart = Date.now();
        node.port.onmessage = (e: MessageEvent<Float32Array>) => submit(ep.push(e.data));
      } catch (e) {
        if (active) fallback(`Audio capture failed (${(e as Error).message}), using browser speech recognition`);
      }
    })();

    return () => {
      active = false;
      submit(ep.flush());
      if (node) node.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      URL.revokeObjectURL(url);
      void ctx.close();
    };
  }, [mode, isMicrophoneEnabled, mediaTrack, meetingId, name, fallback]);

  // ---- Browser Web Speech API (fallback) ----
  useEffect(() => {
    if (mode !== "browser" || !isMicrophoneEnabled) return;
    const Ctor = recognizerCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    let active = true;
    let utteranceStart = 0;
    let chain: Promise<void> = Promise.resolve();
    const enc = new TextEncoder();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    const publishInterim = (text: string) => {
      room.localParticipant
        .publishData(enc.encode(JSON.stringify({ speaker: name, text })), { reliable: false, topic: "interim" })
        .catch(() => {});
    };

    // Finals go through one chain so they arrive in order. A retry reuses the same clientId.
    const saveFinal = (text: string, startMs: number) => {
      const clientId = crypto.randomUUID();
      const capturedAt = Date.now();
      const startSec = startRef.current ? Math.max(0, (startMs - startRef.current) / 1000) : 0;
      chain = chain.then(async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const r = await fetch(`/api/meetings/${meetingId}/segments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ speaker: name, text, startSec, capturedAt, clientId }),
            });
            if (r.ok) {
              setError(null);
              const j = (await r.json()) as { segment?: Segment };
              if (j.segment) segRef.current(j.segment);
              return;
            }
            setError((await r.json().catch(() => null))?.error?.message ?? `HTTP ${r.status}`);
            if (r.status < 500 && r.status !== 429) return;
          } catch (e) {
            setError((e as Error).message);
          }
          await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
        }
      });
    };

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (!utteranceStart) utteranceStart = Date.now();
        if (r.isFinal) {
          saveFinal(text, utteranceStart);
          utteranceStart = 0;
          publishInterim("");
        } else {
          publishInterim(text);
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        active = false;
        setError("Speech recognition was blocked by the browser");
      } else if (e.error === "network") {
        setError("Speech recognition lost its connection, retrying");
      }
    };
    // Chrome ends a session after a long pause. Restart while the mic is on.
    const safeStart = () => {
      try {
        rec.start();
      } catch {}
    };
    rec.onend = () => {
      if (active) setTimeout(() => active && safeStart(), 250);
    };
    safeStart();

    return () => {
      active = false;
      rec.onend = null;
      try {
        rec.stop();
      } catch {}
      publishInterim("");
    };
  }, [mode, isMicrophoneEnabled, meetingId, name, room]);

  return (
    <>
      {isMicrophoneEnabled && (
        <div
          className="absolute right-3 top-3 z-10 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
          role="status"
          title={notice ?? undefined}
        >
          {mode === "sarvam" ? "Transcribing: Sarvam" : "Transcribing: browser speech (fallback)"}
        </div>
      )}
      {mode === "browser" && !supported && (
        <div className="absolute left-3 top-3 z-10 max-w-xs rounded-md border border-warning/30 bg-warning-tint p-2 text-xs text-warning" role="status">
          Sarvam is unavailable and this browser has no speech recognition. Use Chrome or Edge.
        </div>
      )}
      {!isMicrophoneEnabled && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          <MicOff className="size-3" aria-hidden /> Mic off, not transcribing
        </div>
      )}
      {notice && mode === "browser" && (
        <div className="absolute left-3 top-12 z-10 max-w-sm rounded-md border border-warning/30 bg-warning-tint p-2 text-xs text-warning" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="absolute left-3 bottom-12 z-10 max-w-sm rounded-md border border-destructive/40 bg-card p-2 text-xs text-destructive" role="alert">
          Transcription: {error}
        </div>
      )}
    </>
  );
}

/** Receives finalized segments the server broadcast over the LiveKit data channel (a WebSocket). */
function TranscriptListener({ onSegment, onResync, onInterim }: { onSegment: (s: Segment) => void; onResync: () => void; onInterim: (id: string, i: Interim | null) => void }) {
  const room = useRoomContext();
  const segRef = useRef(onSegment);
  segRef.current = onSegment;
  const syncRef = useRef(onResync);
  syncRef.current = onResync;
  const interimRef = useRef(onInterim);
  interimRef.current = onInterim;
  useEffect(() => {
    const dec = new TextDecoder();
    const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic === "interim") {
        try {
          const m = JSON.parse(dec.decode(payload)) as Interim;
          interimRef.current(m.speaker, m.text ? { speaker: m.speaker, text: m.text.slice(0, 500) } : null);
        } catch {}
        return;
      }
      if (topic !== "transcript") return;
      try {
        const m = JSON.parse(dec.decode(payload)) as Segment & { capturedAt?: number | null };
        if (m.capturedAt) lat.e2e.add(Date.now() - m.capturedAt);
        interimRef.current(m.speaker ?? "", null);
        segRef.current({ id: m.id, meetingId: m.meetingId, idx: m.idx, speaker: m.speaker, text: m.text, startSec: m.startSec });
      } catch {}
    };
    const resync = () => syncRef.current();
    const visible = () => document.visibilityState === "visible" && resync();
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Reconnected, resync);
    document.addEventListener("visibilitychange", visible);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.Reconnected, resync);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [room]);
  return null;
}

function DebugOverlay() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      tick((n) => n + 1);
      console.log("[transcript e2e ms]", lat.e2e.stats());
    }, 5000);
    return () => clearInterval(id);
  }, []);
  const st = lat.e2e.stats();
  return (
    <pre className="absolute bottom-3 left-3 z-10 rounded-md bg-black/70 p-2 text-[10px] leading-tight text-white">
      {`e2e n=${st.n} p50=${Math.round(st.p50)} p95=${Math.round(st.p95)}`}
    </pre>
  );
}

function RoomBridge({ onState }: { onState: (s: ConnectionState) => void }) {
  const state = useConnectionState();
  useEffect(() => {
    onState(state);
  }, [state, onState]);
  return null;
}

const Row = memo(function Row({ s }: { s: Segment }) {
  return (
    <div className="text-sm">
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{s.speaker}</span> · {fmtTime(s.startSec)}
      </div>
      <p>{s.text}</p>
    </div>
  );
});

function TranscriptPanel({ segments, interim = [] }: { segments: Segment[]; interim?: Interim[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  useEffect(() => {
    if (nearBottom.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [segments.length, interim.length]);
  return (
    <aside className="flex min-h-0 flex-col border-l bg-card">
      <h2 className="border-b px-3 py-2.5 text-sm font-medium">Live transcript</h2>
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {segments.length === 0 && interim.length === 0 && <p className="text-sm text-muted-foreground">Waiting for someone to speak.</p>}
        {segments.map((s) => (
          <Row key={s.id} s={s} />
        ))}
        {interim.map((i) => (
          <p key={i.speaker} className="text-sm italic text-muted-foreground">
            {i.speaker}: {i.text}
          </p>
        ))}
        <div ref={endRef} />
      </div>
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
  const [now, setNow] = useState(Date.now());
  const started = useRef(false);

  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<MeetingDetail>(`/meetings/${meetingId}`) });
  const me = useMe();
  const projectId = data?.meeting.projectId;
  const leave = () => router.replace(me.data ? `/p/${projectId}/meetings` : `/join/${data?.meeting.inviteCode ?? ""}`);
  const ended = data?.meeting.state === "ended";

  useEffect(() => {
    try {
      const n = localStorage.getItem(GUEST_NAME_KEY);
      if (n) setName(n);
    } catch {}
  }, []);
  useEffect(() => {
    if (data?.meeting.startedAt && !startedAt) setStartedAt(new Date(data.meeting.startedAt).getTime());
  }, [data?.meeting.startedAt, startedAt]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!name || ended) return;
    api<{ token: string; url: string }>("/livekit/token", { method: "POST", json: { meetingId, name } })
      .then(setConn)
      .catch((e: Error) => setConnError(e.message));
  }, [name, meetingId, ended]);

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

  // Segments that arrive before the first meeting fetch finishes are held, never dropped.
  const early = useRef<Segment[]>([]);
  const applySegment = useCallback(
    (seg: Segment) => {
      qc.setQueryData<MeetingDetail>(["meeting", meetingId], (old) => {
        if (!old) {
          early.current.push(seg);
          return old;
        }
        const next = insertSegment(old.segments, seg);
        return next === old.segments ? old : { ...old, segments: next };
      });
    },
    [qc, meetingId],
  );
  const resync = useCallback(() => qc.invalidateQueries({ queryKey: ["meeting", meetingId] }), [qc, meetingId]);
  useEffect(() => {
    if (!data || early.current.length === 0) return;
    const items = early.current.splice(0);
    qc.setQueryData<MeetingDetail>(["meeting", meetingId], (old) =>
      old ? { ...old, segments: items.reduce(insertSegment, old.segments) } : old,
    );
  }, [data, qc, meetingId]);
  const [interim, setInterim] = useState<Record<string, Interim>>({});
  const onInterim = useCallback((id: string, i: Interim | null) => {
    setInterim((cur) => {
      if (!i) {
        if (!(id in cur)) return cur;
        const { [id]: _drop, ...rest } = cur;
        return rest;
      }
      return { ...cur, [id]: i };
    });
  }, []);
  const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  const connected = useProjectEvents(projectId, (ev, d) => {
    if (d.meetingId !== meetingId) return;
    if (ev === "meeting.ended") leave();
  });

  const end = useMutation({
    mutationFn: () => api(`/meetings/${meetingId}/end`, { method: "POST" }),
    onSuccess: leave,
    onError: (e: Error) => toast.error(e.message),
  });

  if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
    return <PageState error="You do not have access to this meeting. Open the invite link you were sent, or sign in as the host." />;
  }
  if (isLoading || error || !data) return <PageState loading={isLoading} error={error?.message} />;

  if (ended) {
    return (
      <div className="flex h-screen flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Brand />
          <span className="truncate text-sm text-muted-foreground">/ {data.meeting.title} (ended)</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={me.data ? `/p/${data.meeting.projectId}/meetings` : "/"}>{me.data ? "Back to meetings" : "Home"}</Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <div className="grid min-h-0 flex-1">
          <TranscriptPanel segments={data.segments} />
        </div>
      </div>
    );
  }

  if (!name) {
    return (
      <main className="mx-auto max-w-md px-4 py-20">
        <form
          className="space-y-4 rounded-lg border bg-card p-6"
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
            <span className={`size-2 rounded-full ${lkState === ConnectionState.Connected ? "bg-positive" : "bg-warning"}`} />
            {lkState === ConnectionState.Connected ? "Connected" : lkState === ConnectionState.Connecting ? "Connecting" : lkState}
          </span>
          {!connected && <span className="text-warning">Live updates reconnecting</span>}
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
          {me.data && <Button size="sm" variant="destructive" disabled={end.isPending} onClick={() => end.mutate()}>
            <PhoneOff /> {end.isPending ? "Ending…" : "End call"}
          </Button>}
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
              <Transcriber meetingId={meetingId} name={name} startedAt={startedAt} onSegment={applySegment} />
              <TranscriptListener onSegment={applySegment} onResync={resync} onInterim={onInterim} />
              {debug && <DebugOverlay />}
            </LiveKitRoom>
          )}
        </div>
        <TranscriptPanel segments={data.segments} interim={Object.values(interim)} />
      </div>
    </div>
  );
}
