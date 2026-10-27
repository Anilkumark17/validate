"use client";
import { useEffect, useRef, useState } from "react";

export type EventName = "meeting.updated" | "meeting.ended";

const NAMES: EventName[] = ["meeting.updated", "meeting.ended"];

/** Subscribes to the project SSE stream. Handler receives parsed payloads. */
export function useProjectEvents(
  projectId: string | undefined,
  handler: (event: EventName, data: Record<string, any>) => void,
) {
  const ref = useRef(handler);
  ref.current = handler;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const es = new EventSource(`/api/projects/${projectId}/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    for (const n of NAMES) {
      es.addEventListener(n, (e) => {
        try {
          ref.current(n, JSON.parse((e as MessageEvent).data));
        } catch {}
      });
    }
    return () => es.close();
  }, [projectId]);

  return connected;
}
