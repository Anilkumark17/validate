import { describe, expect, it } from "vitest";
import { computeStatus, type StatusLink } from "./status";

const L = (stance: StatusLink["stance"], strength: number, speaker: string, rejected = false): StatusLink => ({
  stance,
  strength,
  speaker,
  rejected,
});

describe("computeStatus", () => {
  it("untested with no links", () => {
    expect(computeStatus([]).status).toBe("untested");
  });
  it("ignores rejected and neutral links", () => {
    expect(computeStatus([L("supports", 3, "a", true), L("neutral", 3, "b")]).status).toBe("untested");
  });
  it("supporting", () => {
    const r = computeStatus([L("supports", 2, "a")]);
    expect(r.status).toBe("supporting");
    expect(r.confidence).toBeCloseTo(0.2);
  });
  it("contradicted", () => {
    expect(computeStatus([L("contradicts", 2, "a")]).status).toBe("contradicted");
  });
  it("clamps per speaker net at 3", () => {
    const r = computeStatus([L("supports", 3, "a"), L("supports", 3, "a")]);
    expect(r.support).toBe(3);
  });
  it("same speaker support and contradict nets out", () => {
    expect(computeStatus([L("supports", 2, "a"), L("contradicts", 2, "a")]).status).toBe("untested");
  });
  it("validated", () => {
    const r = computeStatus([L("supports", 2, "a"), L("supports", 2, "b"), L("supports", 2, "c")]);
    expect(r.status).toBe("validated");
  });
  it("validated needs three speakers", () => {
    const r = computeStatus([L("supports", 3, "a"), L("supports", 3, "b")]);
    expect(r.status).toBe("supporting");
  });
  it("invalidated", () => {
    const r = computeStatus([L("contradicts", 2, "a"), L("contradicts", 2, "b")]);
    expect(r.status).toBe("invalidated");
  });
  it("invalidated needs two speakers", () => {
    expect(computeStatus([L("contradicts", 3, "a")]).status).toBe("contradicted");
  });
  it("mixed", () => {
    const r = computeStatus([L("supports", 2, "a"), L("contradicts", 2, "b")]);
    expect(r.status).toBe("mixed");
  });
  it("lopsided stays supporting", () => {
    const r = computeStatus([L("supports", 3, "a"), L("supports", 3, "b"), L("contradicts", 1, "c")]);
    expect(r.status).toBe("supporting");
  });
});
