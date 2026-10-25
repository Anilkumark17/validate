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
  persona?: unknown;
  statusCounts?: Record<string, number>;
  meetingCount?: number;
}

export interface Assumption {
  id: string;
  projectId: string;
  statement: string;
  type: "desirability" | "feasibility" | "viability";
  risk: number;
  owner: string | null;
  status: "untested" | "supporting" | "mixed" | "contradicted" | "validated" | "invalidated";
  confidence: number;
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
  jobStatus: "queued" | "processing" | "done" | "failed";
  jobError: string | null;
  inputTokens: number;
  outputTokens: number;
  modelCalls: number;
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
  processed: boolean;
}

export interface Evidence {
  id: string;
  meetingId: string;
  segmentId: string | null;
  imageUrl: string | null;
  claim: string;
  quote: string | null;
  speaker: string | null;
  createdAt: string;
}

export interface LinkRow {
  id: string;
  evidenceId: string;
  assumptionId: string;
  stance: "supports" | "contradicts" | "neutral";
  strength: number;
  rationale: string | null;
  origin: "model" | "user";
  rejected: boolean;
}

export interface StatusEvent {
  id: string;
  assumptionId: string;
  meetingId: string | null;
  fromStatus: Assumption["status"] | null;
  toStatus: Assumption["status"];
  confidence: number;
  reason: string | null;
  createdAt: string;
}

export interface MeetingDetail {
  meeting: Meeting;
  project: Project;
  segments: Segment[];
  evidence: Evidence[];
  links: LinkRow[];
  assumptions: Assumption[];
  events: StatusEvent[];
}
