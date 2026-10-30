"use client";
import { useEffect, useRef, useState } from "react";

const REACTIONS = [
  { who: "Busy Professional", text: "I like the short workout duration, but I want to know if I can fit it into my unpredictable schedule." },
  { who: "Budget-Conscious Customer", text: "How much does it cost? I already have free workout videos available." },
  { who: "Fitness Enthusiast", text: "15 minutes sounds too short for my fitness goals. What makes this different?" },
];

const SUMMARY = [
  { title: "Common objections", items: ["Cost compared with free videos", "Is 15 minutes enough?"] },
  { title: "Positive reactions", items: ["Short duration appeals to time-pressed people"] },
  { title: "Audience differences", items: ["Professionals ask about flexibility", "Enthusiasts question intensity"] },
  { title: "Suggested improvements", items: ["State what the price includes", "Explain why 15 minutes works", "Show flexible scheduling"] },
];

/** A scripted walk through one scenario. The text is fixed sample output, not a live model call. */
export function Demo() {
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const run = () => {
    if (running) return;
    setShown(0);
    setRunning(true);
    const step = (n: number) => {
      setShown(n);
      if (n >= REACTIONS.length + 1) return setRunning(false);
      timer.current = setTimeout(() => step(n + 1), 900);
    };
    timer.current = setTimeout(() => step(1), 350);
  };

  return (
    <section aria-labelledby="demo-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 md:py-32">
      <h2 id="demo-h" className="lp-serif max-w-[10em] text-[length:var(--step-head)]" data-reveal>See how your customers might respond.</h2>

      <div className="mt-12 overflow-hidden rounded-[var(--radius)] border border-white/10 bg-[var(--surface)]" data-reveal>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="lp-soft text-[length:var(--step-small)]">Product: a new fitness subscription app</p>
            <p className="mt-1 text-[length:var(--step-lead)] font-medium">“Get fit in just 15 minutes a day.”</p>
          </div>
          <button onClick={run} disabled={running} className="lp-btn lp-btn-sm disabled:opacity-60">
            {running ? "Simulating…" : shown ? "Run again" : "Run simulation"}
          </button>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_1fr]" aria-live="polite">
          <ul className="space-y-4">
            {REACTIONS.map((r, i) => (
              <li key={r.who} className={`flex items-start gap-3 transition-opacity duration-500 ${shown > i ? "opacity-100" : "opacity-25"}`}>
                <span aria-hidden className="grid size-9 flex-none place-items-center rounded-full bg-[var(--accent)]/20 text-[length:var(--step-small)] text-[var(--accent)]">{i + 1}</span>
                <div>
                  <p className="lp-soft text-[length:var(--step-small)]">Avatar {i + 1}: {r.who}</p>
                  <p className="mt-1 rounded-2xl rounded-tl-sm bg-[var(--raised)] px-4 py-3">{shown > i ? `“${r.text}”` : "Waiting for the simulation"}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className={`rounded-[10px] border border-white/10 bg-[var(--bg)] p-5 transition-opacity duration-500 ${shown > REACTIONS.length ? "opacity-100" : "opacity-25"}`}>
            <h3 className="font-medium">Summary</h3>
            <div className="mt-4 space-y-4">
              {SUMMARY.map((s) => (
                <div key={s.title}>
                  <h4 className="text-[length:var(--step-small)] text-[var(--accent)]">{s.title}</h4>
                  <ul className="mt-1 space-y-0.5 text-[length:var(--step-small)]">
                    {s.items.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="lp-soft border-t border-white/10 p-5 text-[length:var(--step-small)]">
          Illustrative AI-generated simulation output. These are not actual customer feedback and do not predict real behavior.
        </p>
      </div>
    </section>
  );
}
