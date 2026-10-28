import { describe, expect, it } from "vitest";
import type { BoardAssumption } from "./client";
import { computeProgress, isLeadingQuestion, looksLikeFabricatedEvidence, normalizeKey, riskBucket, riskOf, similarity, STATUSES } from "./constants";
import { applyFilters, NO_FILTERS } from "./filter";
import { generationOutputSchema, guideOutputSchema } from "./schemas";
import { ALLOWED, checkMove, type EvidenceLite } from "./transitions";

describe("risk", () => {
  it("is impact x uncertainty, 1 to 25", () => {
    expect(riskOf(5, 5)).toBe(25);
    expect(riskOf(1, 1)).toBe(1);
    expect(riskOf(4, 5)).toBe(20);
  });
  it("buckets", () => {
    expect([riskBucket(25), riskBucket(15), riskBucket(14), riskBucket(8), riskBucket(7), riskBucket(1)]).toEqual(["high", "high", "medium", "medium", "low", "low"]);
  });
});

describe("progress formula", () => {
  it("is 0% with no assumptions", () => {
    expect(computeProgress({})).toMatchObject({ total: 0, percent: 0 });
  });
  it("counts only validated and invalidated as complete", () => {
    const p = computeProgress({ validated: 1, invalidated: 1, validation_in_progress: 1, evidence_collected: 1, needs_more_evidence: 1, generated: 3, ready_to_validate: 2 });
    expect(p.total).toBe(10);
    expect(p.percent).toBe(20);
    expect(p.inProgress).toBe(1);
    expect(p.awaiting).toBe(5);
    expect(p.needsMoreEvidence).toBe(1);
  });
  it("is 100% when everything is decided", () => {
    expect(computeProgress({ validated: 3, invalidated: 1 }).percent).toBe(100);
  });
});

const ev = (id: string, interpretation: EvidenceLite["interpretation"]): EvidenceLite => ({ id, interpretation });
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("status transitions", () => {
  it("rejects moves that are not allowed", () => {
    const r = checkMove({ from: "generated", to: "validated", rationale: "a long enough reason", evidenceIds: [A], interpretation: "a long enough reading", confirm: true }, [ev(A, "supports")]);
    expect(r).toMatchObject({ ok: false, code: "invalid_transition" });
    for (const s of STATUSES) expect(ALLOWED[s]).not.toContain(s);
  });
  it("allows simple moves without rationale", () => {
    expect(checkMove({ from: "generated", to: "ready_to_validate" }, [])).toEqual({ ok: true });
  });
  it("needs evidence before Evidence Collected", () => {
    expect(checkMove({ from: "validation_in_progress", to: "evidence_collected" }, [])).toMatchObject({ code: "evidence_required" });
    expect(checkMove({ from: "validation_in_progress", to: "evidence_collected" }, [ev(A, "inconclusive")])).toEqual({ ok: true });
  });
  const base = { from: "evidence_collected" as const, to: "validated" as const, rationale: "Interviews support the belief", interpretation: "Most parents described the problem", evidenceIds: [A], confirm: true };
  it("validated needs rationale, interpretation, supporting evidence and confirmation", () => {
    expect(checkMove(base, [ev(A, "supports")])).toEqual({ ok: true });
    expect(checkMove({ ...base, rationale: "" }, [ev(A, "supports")])).toMatchObject({ code: "rationale_required" });
    expect(checkMove({ ...base, interpretation: "" }, [ev(A, "supports")])).toMatchObject({ code: "interpretation_required" });
    expect(checkMove({ ...base, evidenceIds: [] }, [ev(A, "supports")])).toMatchObject({ code: "evidence_required" });
    expect(checkMove({ ...base, confirm: false }, [ev(A, "supports")])).toMatchObject({ code: "confirmation_required" });
    expect(checkMove({ ...base, evidenceIds: [B] }, [ev(A, "supports")])).toMatchObject({ code: "evidence_mismatch" });
  });
  it("does not validate on inconclusive or contradicting evidence and recommends more evidence", () => {
    expect(checkMove(base, [ev(A, "inconclusive")])).toMatchObject({ code: "evidence_insufficient", recommend: "needs_more_evidence" });
    expect(checkMove(base, [ev(A, "contradicts")])).toMatchObject({ code: "evidence_insufficient" });
  });
  it("invalidated needs contradicting evidence", () => {
    const inv = { ...base, to: "invalidated" as const };
    expect(checkMove(inv, [ev(A, "contradicts")])).toEqual({ ok: true });
    expect(checkMove(inv, [ev(A, "supports")])).toMatchObject({ code: "evidence_insufficient" });
  });
  it("reopening and asking for more evidence need a rationale", () => {
    expect(checkMove({ from: "validated", to: "validation_in_progress" }, [])).toMatchObject({ code: "rationale_required" });
    expect(checkMove({ from: "evidence_collected", to: "needs_more_evidence", rationale: "Sample too small to decide" }, [ev(A, "inconclusive")])).toEqual({ ok: true });
  });
});

describe("question and claim guards", () => {
  it("flags hypothetical and leading questions", () => {
    for (const q of ["Would you use this app?", "Do you think this is useful?", "How likely are you to pay for it?", "If we built it, would you try it?", "Imagine you had a helper. What then?", "Don't you agree it is hard?"]) {
      expect(isLeadingQuestion(q), q).toBe(true);
    }
  });
  it("allows past-behavior questions", () => {
    for (const q of ["Tell me about the last time you struggled to decide what to cook for dinner.", "How do you currently keep track of the ingredients available at home?", "Walk me through your last grocery trip."]) {
      expect(isLeadingQuestion(q), q).toBe(false);
    }
  });
  it("flags unsupported statistics presented as fact", () => {
    expect(looksLikeFabricatedEvidence("73% of parents struggle with dinner")).toBe(true);
    expect(looksLikeFabricatedEvidence("Studies show parents are overwhelmed")).toBe(true);
    expect(looksLikeFabricatedEvidence("Parents may struggle to decide what to cook")).toBe(false);
  });
});

describe("duplicate detection", () => {
  it("normalizes keys", () => {
    expect(normalizeKey("  Parents, struggle: to DECIDE!  ")).toBe("parents struggle to decide");
  });
  it("catches reworded repeats but not different assumptions", () => {
    expect(similarity("Parents struggle to decide what to cook on weeknights", "Parents struggle to decide what to cook on weeknight evenings")).toBeGreaterThanOrEqual(0.6);
    expect(similarity("Parents will pay for meal planning", "Grocery stores will share inventory data")).toBeLessThan(0.3);
  });
});

const mk = (o: Partial<BoardAssumption>): BoardAssumption => ({
  id: "x", projectId: "p", title: "t", description: "", category: "usability", rationale: "", impact: 3, uncertainty: 3, risk: 9, confidence: null,
  validationMethod: "Interviews", validationQuestions: [], experimentDescription: "", successCriteria: "", status: "generated", source: "ai_generated",
  provisional: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", stakeholderIds: [], evidenceCount: 0, ...o,
});

describe("board filters", () => {
  const list = [
    mk({ id: "1", title: "Parents pay for meal plans", description: "pricing belief", risk: 20, category: "willingness_to_pay", status: "validated", stakeholderIds: ["s1"], validationMethod: "Survey" }),
    mk({ id: "2", title: "Kids accept suggested meals", description: "about children", risk: 9, category: "usability", stakeholderIds: ["s2"] }),
    mk({ id: "3", title: "Grocery lists stay accurate", description: "inventory", risk: 4, category: "usability", status: "ready_to_validate" }),
  ];
  it("searches title or description, case insensitive", () => {
    expect(applyFilters(list, { ...NO_FILTERS, q: "PRICING" }).map((a) => a.id)).toEqual(["1"]);
    expect(applyFilters(list, { ...NO_FILTERS, q: "kids" }).map((a) => a.id)).toEqual(["2"]);
  });
  it("filters by risk, status, category, stakeholder and method together", () => {
    expect(applyFilters(list, { ...NO_FILTERS, risk: "high" }).map((a) => a.id)).toEqual(["1"]);
    expect(applyFilters(list, { ...NO_FILTERS, status: "ready_to_validate" }).map((a) => a.id)).toEqual(["3"]);
    expect(applyFilters(list, { ...NO_FILTERS, category: "usability" }).map((a) => a.id)).toEqual(["2", "3"]);
    expect(applyFilters(list, { ...NO_FILTERS, stakeholder: "s2" }).map((a) => a.id)).toEqual(["2"]);
    expect(applyFilters(list, { ...NO_FILTERS, method: "Survey", risk: "high" }).map((a) => a.id)).toEqual(["1"]);
    expect(applyFilters(list, { ...NO_FILTERS, method: "Survey", risk: "low" })).toEqual([]);
  });
  it("sorts without mutating the input", () => {
    const copy = [...list];
    expect(applyFilters(list, { ...NO_FILTERS, sort: "title" }).map((a) => a.id)).toEqual(["3", "2", "1"].sort((x, y) => list.find((a) => a.id === x)!.title.localeCompare(list.find((a) => a.id === y)!.title)));
    expect(list).toEqual(copy);
  });
});

const good = {
  stakeholders: [
    { id: "s1", roleName: "Parents who plan meals", description: "People who decide dinner most days.", whyItMatters: "They feel the daily decision.", relevance: 5, interviewPriority: "high", recruitmentCriteria: "Cooks for kids weekly", interviewQuestions: ["Tell me about the last time you chose a dinner."], expectedEvidence: "Recent stories of dinner choices" },
    { id: "s2", roleName: "Household shoppers", description: "People who buy the groceries.", whyItMatters: "They stock the kitchen.", relevance: 3, interviewPriority: "medium", recruitmentCriteria: "Shopped last week", interviewQuestions: ["Walk me through your last grocery trip."], expectedEvidence: "How lists are made" },
  ],
  assumptions: Array.from({ length: 5 }, (_, i) => ({
    id: `a${i + 1}`, title: `Distinct assumption number ${i + 1} about ${["cooking", "pricing", "trust", "inventory", "habits"][i]}`, description: "A specific belief that could be wrong.", category: "problem_severity",
    rationale: "It decides whether the product matters.", impact: 4, uncertainty: 4, provisional: false, validationMethod: "Interviews",
    validationQuestions: ["Tell me about the last time this came up for you."], experimentDescription: "Interview people about a recent event.", successCriteria: "Proposed before interviews: most describe it unprompted.",
  })),
  assumptionStakeholderLinks: Array.from({ length: 5 }, (_, i) => ({ assumptionId: `a${i + 1}`, stakeholderId: i % 2 ? "s2" : "s1" })),
  generationSummary: "Two roles and five assumptions.",
};
const clone = () => JSON.parse(JSON.stringify(good));
const schema = generationOutputSchema({ existingStakeholderKeys: ["e1"], mode: "initial" });

describe("generation output validation", () => {
  it("accepts a well formed response", () => {
    expect(schema.safeParse(good).success).toBe(true);
  });
  it("rejects out of range scores", () => {
    const o = clone();
    o.assumptions[0].impact = 6;
    expect(schema.safeParse(o).success).toBe(false);
    const p = clone();
    p.assumptions[0].uncertainty = 0;
    expect(schema.safeParse(p).success).toBe(false);
  });
  it("rejects duplicate ids and duplicate titles", () => {
    const o = clone();
    o.assumptions[1].id = "a1";
    expect(schema.safeParse(o).success).toBe(false);
    const t = clone();
    t.assumptions[1].title = t.assumptions[0].title.toUpperCase();
    expect(schema.safeParse(t).success).toBe(false);
  });
  it("rejects links to unknown ids and unlinked assumptions", () => {
    const o = clone();
    o.assumptionStakeholderLinks[0].stakeholderId = "s9";
    expect(schema.safeParse(o).success).toBe(false);
    const u = clone();
    u.assumptionStakeholderLinks.pop();
    expect(schema.safeParse(u).success).toBe(false);
  });
  it("accepts links to existing stakeholders by key", () => {
    const o = clone();
    o.assumptionStakeholderLinks[0].stakeholderId = "e1";
    expect(schema.safeParse(o).success).toBe(true);
  });
  it("rejects leading questions and fabricated statistics", () => {
    const o = clone();
    o.assumptions[0].validationQuestions = ["Would you use an app for this?"];
    expect(schema.safeParse(o).success).toBe(false);
    const s = clone();
    s.assumptions[0].description = "73% of parents struggle every night with dinner.";
    expect(schema.safeParse(s).success).toBe(false);
  });
  it("rejects invalid enums and missing fields", () => {
    const o = clone();
    o.stakeholders[0].interviewPriority = "urgent";
    expect(schema.safeParse(o).success).toBe(false);
    const m = clone();
    delete m.assumptions[0].successCriteria;
    expect(schema.safeParse(m).success).toBe(false);
  });
  it("refine mode allows empty arrays", () => {
    const r = generationOutputSchema({ existingStakeholderKeys: [], mode: "refine" });
    expect(r.safeParse({ stakeholders: [], assumptions: [], assumptionStakeholderLinks: [], generationSummary: "Nothing new needed." }).success).toBe(true);
  });
});

describe("interview guide validation", () => {
  const q = (text: string, assumptionId: string | null = null, ladder = "past_behavior") => ({ text, assumptionId, followUps: [], ladder });
  const guide = () => ({
    assumptionsToTest: [{ assumptionId: "a1", whyItIsRisky: "Everything rests on it." }],
    acts: [
      { act: 1, name: "Friendly Welcome and Context Setting", goal: "Build rapport and get consent.", questions: [q("Thanks for joining. Is it okay if I take notes?", null, "context")] },
      { act: 2, name: "Contextual Questions", goal: "Warm up with background.", questions: [q("Tell me about a typical weekday evening at home.", null, "context")] },
      { act: 3, name: "Core Questions and Deep Dive", goal: "Dig into past behavior.", questions: [q("Tell me about the last time you struggled to decide what to cook.", "a1", "specific_story"), q("What did you do instead that evening?", "a1")] },
      { act: 4, name: "Wrap-up and Debrief", goal: "Play back takeaways.", questions: [q("Here is what I heard. Did I get that right?", null, "playback")] },
      { act: 5, name: "Unknown Unknowns", goal: "Catch what was missed.", questions: [q("Is there anything important we have not covered?", null, "open")] },
    ],
    coachNotes: ["Do not pitch the product.", "Ask for stories, not opinions."],
  });
  const gs = guideOutputSchema(["a1"]);
  it("accepts a five act guide with triangulated core questions", () => {
    expect(gs.safeParse(guide()).success).toBe(true);
  });
  it("needs exactly five acts in order", () => {
    const g = guide();
    g.acts.pop();
    expect(gs.safeParse(g).success).toBe(false);
    const h = guide();
    h.acts[0]!.act = 2;
    expect(gs.safeParse(h).success).toBe(false);
  });
  it("rejects hypothetical questions in acts 2 and 3 only", () => {
    const g = guide();
    g.acts[2]!.questions[0]!.text = "Would you use an app to decide dinner?";
    expect(gs.safeParse(g).success).toBe(false);
    const h = guide();
    h.acts[3]!.questions[0]!.text = "Would that summary match what you meant?";
    expect(gs.safeParse(h).success).toBe(true);
  });
  it("needs at least two core questions per assumption", () => {
    const g = guide();
    g.acts[2]!.questions.pop();
    expect(gs.safeParse(g).success).toBe(false);
  });
});
