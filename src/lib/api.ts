export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiRequestError(data?.error?.code ?? "error", data?.error?.message ?? res.statusText, res.status);
  }
  return data as T;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  targetUser: string | null;
  createdAt: string;
  meetingCount?: number;
  assumptionTotal?: number;
  progressPercent?: number;
  audienceState?: "unknown" | "detected" | "confirmed" | "skipped";
  /** Text of the main "Project context" entry (single project reads and saves only). */
  context?: string;
}

export interface Persona {
  id: string;
  projectId: string;
  name: string;
  summary: string;
  jtbdSummary: string;
  mindsetSummary: string;
  segmentHints: string[];
  systemPrompt: string;
  status: "draft" | "approved";
  source: "ai_generated" | "user_created";
  sourceCustomerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContextEntry {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  heldAt: string | null;
  scheduledFor: string | null;
  inviteCode: string;
  source: "live_call" | "transcript_upload" | "manual";
  state: "scheduled" | "live" | "ended";
  participants: string[];
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface Segment {
  id: string;
  meetingId: string;
  idx: number;
  speaker: string | null;
  text: string;
  startSec: number | null;
}

export interface MeetingDetail {
  meeting: Meeting;
  segments: Segment[];
}
