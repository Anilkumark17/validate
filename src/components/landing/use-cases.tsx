"use client";
import { useState } from "react";
import { USE_CASES } from "./data";

/** Four use cases. Selecting one shows a sample avatar reaction and the insight it produces. */
export function UseCases() {
  const [id, setId] = useState(USE_CASES[0]!.id);
  const active = USE_CASES.find((u) => u.id === id)!;

  return (
    <section id="roadmap" aria-labelledby="uc-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 md:py-32">
      <p className="lp-soft text-[length:var(--step-small)]" data-reveal>Explore what your customers think</p>
      <h2 id="uc-h" className="lp-serif mt-3 text-[length:var(--step-head)]" data-reveal>Test before you launch.</h2>

      <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div role="tablist" aria-label="Use cases" className="grid gap-3">
          {USE_CASES.map((u) => {
            const on = u.id === id;
            return (
              <button
                key={u.id}
                role="tab"
                id={`uc-tab-${u.id}`}
                aria-selected={on}
                aria-controls="uc-panel"
                onClick={() => setId(u.id)}
                className={`rounded-[var(--radius)] border p-5 text-left transition-colors ${on ? "border-[var(--accent)] bg-[var(--raised)]" : "border-white/10 bg-[var(--surface)] hover:bg-[var(--raised)]"}`}
              >
                <span className="text-[length:var(--step-lead)] font-medium leading-snug">{u.title}</span>
                <span className="lp-soft mt-1 block">{u.body}</span>
              </button>
            );
          })}
        </div>

        <div id="uc-panel" role="tabpanel" aria-labelledby={`uc-tab-${active.id}`} className="lp-fade-in rounded-[var(--radius)] border border-white/10 bg-[var(--surface)] p-7" key={active.id}>
          <p className="text-[length:var(--step-small)] text-[var(--accent)]">Tested</p>
          <p className="mt-1 font-medium">{active.stimulus}</p>
          <div className="mt-6 flex items-start gap-3">
            <span aria-hidden className="grid size-9 flex-none place-items-center rounded-full bg-[var(--accent)]/20 text-[length:var(--step-small)] text-[var(--accent)]">AI</span>
            <div>
              <p className="lp-soft text-[length:var(--step-small)]">{active.avatar}</p>
              <p className="mt-1 rounded-2xl rounded-tl-sm bg-[var(--raised)] px-4 py-3">“{active.reaction}”</p>
            </div>
          </div>
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="lp-soft text-[length:var(--step-small)]">Insight</p>
            <p className="mt-1">{active.insight}</p>
          </div>
          <p className="lp-soft mt-6 text-[length:var(--step-small)]">Sample output, written to show the format. Not real customer feedback.</p>
        </div>
      </div>
    </section>
  );
}
