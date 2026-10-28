import type { Status } from "./constants";

/** Moves allowed on the board. Everything else is rejected by the server. */
export const ALLOWED: Record<Status, readonly Status[]> = {
  generated: ["ready_to_validate", "validation_in_progress"],
  ready_to_validate: ["generated", "validation_in_progress"],
  validation_in_progress: ["ready_to_validate", "evidence_collected", "needs_more_evidence"],
  evidence_collected: ["validation_in_progress", "validated", "invalidated", "needs_more_evidence"],
  validated: ["validation_in_progress", "needs_more_evidence"],
  invalidated: ["validation_in_progress", "needs_more_evidence"],
  needs_more_evidence: ["ready_to_validate", "validation_in_progress", "evidence_collected"],
};

export const isFinal = (s: Status) => s === "validated" || s === "invalidated";

/** Moves that always need a written reason: closing, reopening, or asking for more evidence. */
export const needsRationale = (from: Status, to: Status) => isFinal(to) || isFinal(from) || to === "needs_more_evidence";

export interface EvidenceLite {
  id: string;
  interpretation: "supports" | "contradicts" | "inconclusive";
}

export interface MoveRequest {
  from: Status;
  to: Status;
  rationale?: string | null;
  interpretation?: string | null;
  evidenceIds?: string[];
  confirm?: boolean;
}

export type MoveCheck = { ok: true } | { ok: false; code: string; message: string; recommend?: Status };

/**
 * The single source of truth for status rules. Runs on the server for every move.
 * `evidence` is every evidence record of the assumption.
 */
export function checkMove(req: MoveRequest, evidence: EvidenceLite[]): MoveCheck {
  const { from, to } = req;
  if (from === to) return { ok: false, code: "no_change", message: "The assumption is already in that status" };
  if (!ALLOWED[from].includes(to)) {
    return { ok: false, code: "invalid_transition", message: `Cannot move from ${from} to ${to}` };
  }
  const rationale = (req.rationale ?? "").trim();
  if (needsRationale(from, to) && rationale.length < 10) {
    return { ok: false, code: "rationale_required", message: "Write a decision rationale (at least 10 characters)" };
  }
  if (to === "evidence_collected" && evidence.length === 0) {
    return { ok: false, code: "evidence_required", message: "Record at least one piece of evidence first" };
  }
  if (isFinal(to)) {
    const ids = req.evidenceIds ?? [];
    if (ids.length === 0) return { ok: false, code: "evidence_required", message: "Select the evidence this decision rests on" };
    const byId = new Map(evidence.map((e) => [e.id, e]));
    const picked = ids.map((id) => byId.get(id));
    if (picked.some((e) => !e)) return { ok: false, code: "evidence_mismatch", message: "Selected evidence does not belong to this assumption" };
    if (!(req.interpretation ?? "").trim() || (req.interpretation ?? "").trim().length < 10) {
      return { ok: false, code: "interpretation_required", message: "Write your interpretation of the evidence (at least 10 characters)" };
    }
    if (req.confirm !== true) return { ok: false, code: "confirmation_required", message: "Confirm the decision explicitly" };
    const wanted = to === "validated" ? "supports" : "contradicts";
    if (!picked.some((e) => e!.interpretation === wanted)) {
      const inconclusiveOnly = picked.every((e) => e!.interpretation === "inconclusive");
      return {
        ok: false,
        code: "evidence_insufficient",
        message:
          to === "validated"
            ? "None of the selected evidence supports the assumption. Select supporting evidence or ask for more."
            : "None of the selected evidence contradicts the assumption. Select contradicting evidence or ask for more.",
        recommend: inconclusiveOnly || picked.every((e) => e!.interpretation !== wanted) ? "needs_more_evidence" : undefined,
      };
    }
  }
  return { ok: true };
}
