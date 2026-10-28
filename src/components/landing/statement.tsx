"use client";
import { useEffect, useRef } from "react";

const WORDS = [["Roadmaps", "are", "bets."], ["Price", "them", "first."]];
const TOTAL = WORDS.flat().length;

/** The headline lights up word by word as it scrolls into the middle of the screen. */
export function Statement() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.style.setProperty("--p", "1");
      return;
    }
    let raf = 0;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.6)));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  let n = 0;
  return (
    <section ref={ref} aria-labelledby="stmt-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-[18svh]" style={{ ["--p" as string]: 1 }}>
      <h2 id="stmt-h" className="lp-serif text-[clamp(3rem,11vw,13rem)]">
        {WORDS.map((line, li) => (
          <span key={li} className="block">
            {line.map((w) => {
              const i = n++;
              return (
                <span
                  key={w}
                  className="mr-[0.22em] inline-block"
                  style={{ opacity: `clamp(0.16, calc(0.16 + (var(--p) * ${TOTAL + 1} - ${i}) * 0.84), 1)` }}
                >
                  {w}
                </span>
              );
            })}
          </span>
        ))}
      </h2>
      <div className="mt-12 grid gap-6 md:grid-cols-12" data-reveal>
        <p className="max-w-[46ch] text-[length:var(--step-lead)] leading-snug md:col-span-6 md:col-start-7">
          Most get funded on conviction, a loud stakeholder, or last quarter&apos;s win. The ones that sink a quarter usually rest on one belief nobody tested. Validate prices each bet before the sprint starts.
        </p>
      </div>
    </section>
  );
}
