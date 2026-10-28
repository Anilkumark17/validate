"use client";
import { useEffect, useId, useState } from "react";

/** Sample bets already on the board. Risk is impact times uncertainty, as in the product. */
const OTHERS = [
  { id: "a", title: "Subscription plans", impact: 5, unc: 4 },
  { id: "b", title: "Guest checkout", impact: 4, unc: 2 },
  { id: "c", title: "Order tracking page", impact: 3, unc: 3 },
];
const ROW = 46;

export const bucket = (r: number) =>
  r >= 15
    ? { word: "High", cls: "text-[var(--p-high)]", dot: "bg-[var(--p-high)]" }
    : r >= 8
      ? { word: "Medium", cls: "text-[var(--p-medium)]", dot: "bg-[#b45309]" }
      : { word: "Low", cls: "text-[var(--p-muted)]", dot: "bg-[var(--p-input)]" };

/** The product's defining control: price a bet and watch the board rank it. It works. */
export function RiskControl({ autoplay = true }: { autoplay?: boolean }) {
  const id = useId();
  const [text, setText] = useState("AI shopping assistant");
  const [impact, setImpact] = useState(autoplay ? 1 : 5);
  const [unc, setUnc] = useState(autoplay ? 1 : 4);

  // The sliders settle on a sample score when the control scrolls into view, so it shows what it does.
  useEffect(() => {
    if (!autoplay) return;
    const t1 = setTimeout(() => setImpact(5), 900);
    const t2 = setTimeout(() => setUnc(4), 1350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [autoplay]);

  const risk = impact * unc;
  const b = bucket(risk);
  const rows = [{ id: "me", title: text.trim() || "Your bet", impact, unc, mine: true }, ...OTHERS.map((o) => ({ ...o, mine: false }))]
    .map((r) => ({ ...r, risk: r.impact * r.unc }))
    .sort((a, c) => c.risk - a.risk || Number(c.mine) - Number(a.mine));

  return (
    <div data-ui className="w-[min(480px,100%)] rounded-xl bg-[var(--p-card)] p-5 text-[var(--p-ink)] sm:p-6">
      <label htmlFor={`${id}-t`} className="text-[13px] text-[var(--p-muted)]">The bet</label>
      <input
        id={`${id}-t`}
        value={text}
        maxLength={60}
        onChange={(e) => setText(e.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-[var(--p-input)] bg-white px-3 text-[15px] font-medium"
      />

      <div className="mt-5 grid gap-4">
        {[
          ["Impact if wrong", impact, setImpact, "1 is a shrug, 5 sinks the quarter"],
          ["How little you know", unc, setUnc, "1 is observed, 5 is a gut call"],
        ].map(([label, value, set, hint], i) => (
          <div key={label as string}>
            <label htmlFor={`${id}-${i}`} className="flex items-baseline justify-between text-[14px] font-medium">
              <span>{label as string}</span>
              <span className="lp-num text-[var(--p-muted)]">{value as number} of 5</span>
            </label>
            <input id={`${id}-${i}`} type="range" min={1} max={5} step={1} value={value as number} onChange={(e) => (set as (n: number) => void)(Number(e.target.value))} className="lp-range" aria-describedby={`${id}-${i}h`} />
            <p id={`${id}-${i}h`} className="-mt-1 text-[13px] text-[var(--p-muted)]">{hint as string}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 pt-5" aria-live="polite">
        <div>
          <p className="text-[13px] text-[var(--p-muted)]">Risk, impact times uncertainty</p>
          <p className="flex items-baseline gap-2">
            <span key={risk} className="lp-pop lp-num text-[56px] font-semibold leading-none tracking-tight">{risk}</span>
            <span className="text-[14px] text-[var(--p-muted)]">of 25</span>
          </p>
        </div>
        <p className={`text-[15px] font-medium ${b.cls}`}>{b.word}</p>
      </div>

      <p className="mt-5 text-[13px] text-[var(--p-muted)]">Board order, riskiest first</p>
      <ol className="relative mt-2" style={{ height: ROW * rows.length }}>
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={`lp-row absolute inset-x-0 flex items-center gap-3 rounded-md border px-3 text-[14px] ${r.mine ? "border-[var(--p-chart)] bg-[var(--p-chart-tint)]" : "border-[var(--p-border)] bg-[var(--p-ground)]"}`}
            style={{ height: ROW - 6, transform: `translateY(${i * ROW}px)` }}
          >
            <span className={`size-2 shrink-0 rounded-full ${bucket(r.risk).dot}`} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{r.title}</span>
            <span className="lp-num font-medium">{r.risk}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
