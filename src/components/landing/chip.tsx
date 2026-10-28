"use client";
import { useEffect, useState } from "react";

const SAMPLES = [
  { n: 20, word: "High", dot: "#c4242a" },
  { n: 12, word: "Medium", dot: "#b45309" },
  { n: 6, word: "Low", dot: "#9aa3b0" },
  { n: 25, word: "High", dot: "#c4242a" },
];

/**
 * The piece of the product that stands in for a word in the poster sentence: a live risk score
 * that keeps pricing different bets. Sized in em, so it scales with the type around it.
 */
export function RiskChip() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % SAMPLES.length), 2000);
    return () => clearInterval(t);
  }, []);
  const s = SAMPLES[i]!;
  return (
    <span
      data-ui
      role="img"
      aria-label={`Risk ${s.n} of 25, ${s.word}`}
      className="mx-[0.02em] inline-flex h-[0.7em] w-[1.95em] items-center justify-center gap-[0.12em] rounded-[0.26em] bg-[var(--paper)] align-[-0.02em] text-[var(--paper-ink)]"
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
    >
      <span className="size-[0.13em] rounded-full transition-colors duration-500" style={{ background: s.dot }} aria-hidden />
      <span key={s.n} className="lp-pop lp-num text-[0.46em] font-semibold leading-none tracking-tight">{s.n}</span>
      <span className="text-[0.2em] font-medium leading-none opacity-60" aria-hidden>of 25</span>
    </span>
  );
}
