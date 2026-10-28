"use client";
import { useState } from "react";

const COLS = ["Generated", "Ready to validate", "In progress", "Validated"] as const;

const INITIAL = [
  { id: 1, t: "Parents will pay for a monthly meal plan", i: 5, u: 4, col: 0 },
  { id: 2, t: "Families stay past month one", i: 4, u: 4, col: 0 },
  { id: 3, t: "Delivery partners will integrate", i: 3, u: 4, col: 0 },
  { id: 4, t: "Families plan the week on Sunday", i: 4, u: 3, col: 1 },
  { id: 5, t: "Kids' tastes can be learned in a week", i: 4, u: 3, col: 1 },
  { id: 6, t: "Recipe import works on any site", i: 4, u: 3, col: 2 },
  { id: 7, t: "Lists build from the plan", i: 3, u: 3, col: 2 },
  { id: 8, t: "Parents struggle to pick dinner", i: 5, u: 4, col: 3 },
];

const dot = (r: number) => (r >= 15 ? "bg-[var(--p-high)]" : r >= 8 ? "bg-[#b45309]" : "bg-[var(--p-input)]");

/** The assumption board, working. Select a card and it moves one status along. */
export function Board() {
  const [cards, setCards] = useState(INITIAL);
  const [last, setLast] = useState<number | null>(null);
  const done = cards.filter((c) => c.col === 3).length;

  const advance = (id: number) => {
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, col: (c.col + 1) % 4 } : c)));
    setLast(id);
  };

  return (
    <section id="board" aria-labelledby="board-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 md:py-[140px]">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4" data-reveal>
        <h2 id="board-h" className="lp-serif max-w-[9em] text-[length:var(--step-head)]">Move bets through discovery.</h2>
        <p className="max-w-[36ch] text-[length:var(--step-body)]">Select any card and it moves one status to the right, the way a bet moves from a hunch to a verdict. Four of the seven statuses are shown.</p>
      </div>

      <div className="mt-12 rounded-[var(--radius)] bg-[var(--surface)] p-3 sm:p-6 md:mt-16" data-reveal style={{ ["--d" as string]: "100ms" }}>
        <div data-ui className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="mb-4 flex items-center gap-3 px-1 text-[14px] text-[var(--ink)]">
              <span className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--raised)]" aria-hidden>
                <span className="block h-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${(done / cards.length) * 100}%` }} />
              </span>
              <span aria-live="polite"><span className="lp-num font-medium">{done}</span> <span className="text-[var(--muted)]">of <span className="lp-num">{cards.length}</span> tested</span></span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {COLS.map((name, ci) => {
                const here = cards.filter((c) => c.col === ci);
                return (
                  <div key={name} className="min-h-[300px] rounded-lg bg-[#e9ecf1] p-2">
                    <p className="flex items-center gap-2 px-2 py-1.5 text-[14px] font-medium text-[var(--p-ink)]">
                      {ci === 3 && <span className="size-2 rounded-full bg-[var(--p-chart)]" aria-hidden />}
                      {name}
                      <span className="lp-num ml-auto text-[13px] font-normal text-[var(--p-muted)]">{here.length}</span>
                    </p>
                    <div className="space-y-2">
                      {here.map((c) => (
                        <button
                          key={`${c.id}-${c.col}`}
                          type="button"
                          onClick={() => advance(c.id)}
                          aria-label={`${c.t}. Move to ${COLS[(c.col + 1) % 4]}`}
                          className={`block w-full rounded-lg border border-[var(--p-border)] bg-white p-3 text-left text-[var(--p-ink)] transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-[var(--p-input)] active:scale-[0.99] ${last === c.id ? "lp-fade-in" : ""}`}
                        >
                          <span className="block text-[14px] font-medium leading-5">{c.t}</span>
                          <span className="mt-2 flex items-center gap-2 text-[13px] text-[var(--p-muted)]">
                            <span className={`size-2 rounded-full ${dot(c.i * c.u)}`} aria-hidden />
                            <span className="lp-num font-medium text-[var(--p-ink)]">{c.i * c.u}</span>
                            <span>risk</span>
                          </span>
                        </button>
                      ))}
                      {here.length === 0 && <p className="grid h-14 place-items-center rounded-md border border-dashed border-[var(--p-input)] text-[13px] text-[var(--p-muted)]">Nothing here</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
