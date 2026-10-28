"use client";
import { useState } from "react";

const ITEMS = [
  { sentence: "Surface the assumptions behind every bet.", result: "Paste the idea. Get five to twelve assumptions and two to six roles worth interviewing.", bg: "#2c4f94", ink: "#ffffff", track: "rgba(255,255,255,0.3)" },
  { sentence: "Score each one by impact and doubt.", result: "Impact times uncertainty, from 1 to 25. High starts at 15 and rises to the top of the board.", bg: "#f2f2ef", ink: "#0b0c0e", track: "rgba(11,12,14,0.25)" },
  { sentence: "Run discovery with a five-act guide.", result: "Welcome, context, core, wrap-up and unknowns. Every question asks about the past, never what people would do.", bg: "#263246", ink: "#ffffff", track: "rgba(255,255,255,0.3)" },
  { sentence: "Interview live, transcript written for you.", result: "Guests join with a link and a name, no account. Every word lands in the transcript as it is said.", bg: "#7aa7ec", ink: "#0b0c0e", track: "rgba(11,12,14,0.25)" },
  { sentence: "Defend the decision with the record.", result: "Each status change stores a reason and its evidence. Nobody, including you, can edit the history.", bg: "#d5d6d2", ink: "#0b0c0e", track: "rgba(11,12,14,0.25)" },
];

/** The product's own switch, built in em so it scales with the sentence it ends. */
function Switch({ on, onChange, label, track }: { on: boolean; onChange: () => void; label: string; track: string }) {
  return (
    <button
      data-ui
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className="relative h-[1.1em] w-[1.95em] shrink-0 rounded-full transition-colors duration-300 max-md:h-11 max-md:w-20"
      style={{ background: on ? track : "#2a2e35" }}
    >
      <span
        className="absolute left-[0.1em] top-[0.1em] block size-[0.9em] rounded-full transition-transform duration-300 max-md:left-1 max-md:top-1 max-md:size-9"
        style={{ background: on ? "#fff" : "#f2f2ef", transform: on ? "translateX(0.85em)" : "none" }}
        aria-hidden
      />
    </button>
  );
}

export function Features() {
  const [on, setOn] = useState([true, false, true, false, false]);
  return (
    <section aria-label="What Validate does">
      {ITEMS.map((it, i) => (
        <div key={it.sentence} className="lp-band" style={{ background: on[i] ? it.bg : "var(--bg)", color: on[i] ? it.ink : "var(--ink)" }} data-reveal="fade">
          <div className="mx-auto flex min-h-[132px] max-w-[1600px] items-center gap-6 px-[var(--margin)] py-8 text-[clamp(1.75rem,0.9rem+3.6vw,4.5rem)] md:min-h-[20vh]">
            <div className="min-w-0 flex-1">
              <h2 className={`lp-serif text-[1em] md:whitespace-nowrap ${on[i] ? "" : "text-[var(--muted)]"}`} style={{ lineHeight: 1 }}>
                {it.sentence}
              </h2>
              {on[i] && <p key="r" className="lp-fade-in mt-3 max-w-[58ch] text-[length:var(--step-body)] leading-6 opacity-90">{it.result}</p>}
            </div>
            <Switch on={on[i]} track={it.track} label={it.sentence} onChange={() => setOn((s) => s.map((v, j) => (j === i ? !v : v)))} />
          </div>
        </div>
      ))}
    </section>
  );
}
