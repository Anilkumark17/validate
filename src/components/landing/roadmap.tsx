"use client";
import { useEffect, useRef, useState } from "react";

type Bet = { id: string; t: string; i: number; u: number };
const LANES: { name: string; bets: Bet[] }[] = [
  { name: "Now", bets: [{ id: "n1", t: "Order tracking page", i: 3, u: 3 }, { id: "n2", t: "Guest checkout", i: 4, u: 2 }, { id: "n3", t: "Saved cards", i: 3, u: 2 }] },
  { name: "Next", bets: [{ id: "x1", t: "Loyalty points", i: 4, u: 3 }, { id: "x2", t: "Subscription plans", i: 5, u: 4 }, { id: "x3", t: "AI shopping assistant", i: 5, u: 5 }] },
  { name: "Later", bets: [{ id: "l1", t: "Gift cards", i: 2, u: 2 }, { id: "l2", t: "Native app", i: 4, u: 4 }, { id: "l3", t: "Seller marketplace", i: 5, u: 4 }] },
];
const ORDER = LANES.flatMap((l) => l.bets.map((b) => b.id));
const RISKIEST = "x3";
const CARD = 84;

const tone = (r: number) => (r >= 15 ? ["bg-[var(--p-high)]", "high"] : r >= 8 ? ["bg-[#b45309]", "medium"] : ["bg-[var(--p-input)]", "low"]);

/** Pinned scene: scrolling prices a Now, Next, Later roadmap, then ranks it and flags what needs evidence. */
export function Roadmap() {
  const ref = useRef<HTMLElement>(null);
  const [priced, setPriced] = useState(ORDER.length);
  const [sorted, setSorted] = useState(true);
  const [flag, setFlag] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wide = window.matchMedia("(min-width: 900px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const tick = () => {
      raf = 0;
      if (!wide.matches || reduced.matches) {
        setPriced(ORDER.length);
        setSorted(true);
        setFlag(true);
        return;
      }
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (r.height - window.innerHeight)));
      setPriced(Math.min(ORDER.length, Math.max(0, Math.floor(((p - 0.06) / 0.5) * ORDER.length + 0.999))));
      setSorted(p > 0.68);
      setFlag(p > 0.82);
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

  const risky = LANES.flatMap((l) => l.bets).filter((b) => b.i * b.u >= 15).length;

  return (
    <section ref={ref} id="roadmap" aria-labelledby="road-h" className="relative min-[900px]:h-[230vh]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-12 px-[var(--margin)] py-24 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-[100svh] min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-16 min-[900px]:py-0">
        <div className="min-[900px]:w-5/12">
          <h2 id="road-h" className="lp-serif text-[length:var(--step-head)]" data-reveal>Your roadmap, priced.</h2>
          <p className="mt-6 max-w-[34ch] text-[length:var(--step-lead)] leading-snug" data-reveal style={{ ["--d" as string]: "90ms" }}>
            Every bet gets an impact score and a doubt score. The ones that rest on a guess rise to the top.
          </p>
          <p className="lp-num mt-8 text-[length:var(--step-body)] text-[var(--muted)]" aria-live="polite">
            <span className="text-[var(--ink)]">{priced}</span> of {ORDER.length} bets priced
          </p>
          <p className={`mt-2 text-[length:var(--step-body)] transition-opacity duration-500 ${flag ? "opacity-100" : "opacity-0"}`}>
            <span className="lp-num">{risky}</span> bets need evidence before you commit.
          </p>
        </div>

        <div className="min-w-0 flex-1" data-reveal="fade">
          <div data-ui className="rounded-xl bg-[var(--p-card)] p-3 text-[var(--p-ink)] sm:p-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {LANES.map((lane) => {
                const ranked = [...lane.bets].sort((a, b) => b.i * b.u - a.i * a.u);
                return (
                  <div key={lane.name} className="min-w-0 rounded-lg bg-[var(--p-ground)] p-2">
                    <p className="px-1.5 pb-2 pt-1 text-[14px] font-medium">{lane.name}</p>
                    <div className="relative" style={{ height: CARD * 3 }}>
                      {lane.bets.map((b, idx) => {
                        const risk = b.i * b.u;
                        const on = priced > ORDER.indexOf(b.id);
                        const slot = sorted ? ranked.indexOf(b) : idx;
                        const [dot, word] = tone(risk);
                        const top = flag && b.id === RISKIEST;
                        return (
                          <div
                            key={b.id}
                            className={`lp-row absolute inset-x-0 rounded-md border bg-white p-2.5 sm:p-3 ${top ? "border-[var(--p-chart)]" : "border-[var(--p-border)]"}`}
                            style={{ height: CARD - 8, transform: `translateY(${slot * CARD}px)` }}
                          >
                            <p className="line-clamp-2 text-[13px] font-medium leading-[17px] sm:text-[14px] sm:leading-[18px]">{b.t}</p>
                            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--p-muted)] sm:text-[13px]">
                              {on ? (
                                <span key="s" className="lp-fade-in inline-flex items-center gap-1.5">
                                  <span className={`size-2 rounded-full ${dot}`} aria-hidden />
                                  <span className="lp-num font-semibold text-[var(--p-ink)]">{risk}</span>
                                  <span>{word}</span>
                                </span>
                              ) : (
                                <span>Unscored</span>
                              )}
                            </p>
                            {top && <span className="lp-fade-in absolute -top-2 right-2 rounded bg-[var(--p-chart)] px-1.5 text-[11px] font-medium text-white">Test first</span>}
                          </div>
                        );
                      })}
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
