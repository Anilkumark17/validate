export type SseEventName =
  | "segment.added"
  | "evidence.added"
  | "assumption.updated"
  | "meeting.updated"
  | "meeting.ended"
  | "pipeline.state"
  | "pipeline.error";

type Sink = (chunk: string) => void;
const g = globalThis as unknown as { __sse?: Map<string, Set<Sink>> };
const hub = (g.__sse ??= new Map());

export function publish(projectId: string, event: SseEventName, data: Record<string, unknown>) {
  const sinks = hub.get(projectId);
  if (!sinks) return;
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const s of sinks) s(chunk);
}

export function subscribe(projectId: string, signal: AbortSignal): Response {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sink: Sink = (c) => {
        try {
          controller.enqueue(enc.encode(c));
        } catch {
          cleanup();
        }
      };
      let set = hub.get(projectId);
      if (!set) hub.set(projectId, (set = new Set()));
      set.add(sink);
      sink(`retry: 3000\n: connected\n\n`);
      const ping = setInterval(() => sink(`: ping\n\n`), 15_000);
      cleanup = () => {
        clearInterval(ping);
        set!.delete(sink);
        if (set!.size === 0) hub.delete(projectId);
        try {
          controller.close();
        } catch {}
      };
      signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
