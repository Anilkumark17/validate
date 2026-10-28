"use client";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProgressCounts, Status } from "./constants";

export interface BoardAssumption {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: string;
  rationale: string;
  impact: number;
  uncertainty: number;
  risk: number | null;
  confidence: number | null;
  validationMethod: string;
  validationQuestions: string[];
  experimentDescription: string;
  successCriteria: string;
  status: Status;
  source: "ai_generated" | "user_created";
  provisional: boolean;
  createdAt: string;
  updatedAt: string;
  stakeholderIds: string[];
  evidenceCount: number;
}

export interface BoardStakeholder {
  id: string;
  projectId: string;
  roleName: string;
  description: string;
  whyItMatters: string;
  relevance: number;
  interviewPriority: "high" | "medium" | "low";
  recruitmentCriteria: string;
  interviewQuestions: string[];
  expectedEvidence: string;
  source: "ai_generated" | "user_created";
  assumptionIds: string[];
  interviewCount: number;
  evidenceCount: number;
}

export interface Run {
  id: string;
  kind: "initial" | "refine";
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
  summary: string | null;
  attempts: number;
  model: string | null;
  examples: string[];
  finishedAt: string | null;
  createdAt: string;
  result: {
    created: { assumptions: number; stakeholders: number; links: number };
    skipped: { assumptions: number; stakeholders: number };
    suggestedChanges: { assumptionId: string; title: string; field: string; proposed: string; reason: string }[];
    possiblyObsolete: { assumptionId: string; title: string; reason: string }[];
  } | null;
}

export interface BoardData {
  project: { id: string; name: string; description: string | null; targetUser: string | null; audienceState: "unknown" | "detected" | "confirmed" | "skipped"; context: string };
  progress: ProgressCounts;
  assumptions: BoardAssumption[];
  stakeholders: BoardStakeholder[];
  runs: { initial: Run | null; refine: Run | null };
}

export interface EvidenceRow {
  id: string;
  assumptionId: string;
  stakeholderId: string | null;
  meetingId: string | null;
  type: string;
  source: string;
  summary: string;
  interpretation: "supports" | "contradicts" | "inconclusive";
  strength: "weak" | "moderate" | "strong";
  researchedOn: string;
  reference: string | null;
  createdAt: string;
  stakeholderRole: string | null;
  assumptionTitle?: string;
}

export interface DecisionRow {
  id: string;
  assumptionId: string;
  fromStatus: Status;
  toStatus: Status;
  rationale: string;
  interpretation: string | null;
  evidenceIds: string[];
  createdAt: string;
  actorName: string | null;
  assumptionTitle?: string;
}

export interface AssumptionDetail {
  assumption: BoardAssumption;
  stakeholderIds: string[];
  evidence: EvidenceRow[];
  decisions: DecisionRow[];
}

export const boardKey = (projectId: string) => ["board", projectId] as const;

const active = (r: Run | null) => r?.status === "pending" || r?.status === "running";

/** Shared by every project page. Polls every 3 s while a generation run is active. */
export function useBoard(projectId: string) {
  return useQuery({
    queryKey: boardKey(projectId),
    queryFn: () => api<BoardData>(`/projects/${projectId}/board`),
    refetchInterval: (q) => (active(q.state.data?.runs.initial ?? null) || active(q.state.data?.runs.refine ?? null) ? 3000 : false),
    staleTime: 3000,
  });
}

/** After any change that can move progress, assumptions or stakeholders. */
export function refreshBoard(qc: QueryClient, projectId: string) {
  void qc.invalidateQueries({ queryKey: boardKey(projectId) });
  void qc.invalidateQueries({ queryKey: ["evidence", projectId] });
  void qc.invalidateQueries({ queryKey: ["decisions", projectId] });
  void qc.invalidateQueries({ queryKey: ["assumption", projectId] });
}

export const isActive = active;
