"use client";
import { useEffect, useRef, useState } from "react";
import { RiskControl } from "./risk-control";

/** The control on its own stage. It plays once when it scrolls into view, then it is yours. */
export function Price() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="price" aria-labelledby="price-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 md:py-[16svh]">
      <div className="grid items-center gap-12 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <h2 id="price-h" className="lp-serif text-[length:var(--step-head)]" data-reveal>Price a bet in ten seconds.</h2>
          <p className="mt-6 max-w-[36ch] text-[length:var(--step-lead)] leading-snug" data-reveal style={{ ["--d" as string]: "90ms" }}>
            Rate the impact if you are wrong, and how little you know. Validate multiplies them and ranks the bet against the rest of the board.
          </p>
          <p className="lp-soft mt-5 max-w-[40ch] text-[length:var(--step-body)]" data-reveal style={{ ["--d" as string]: "160ms" }}>
            Impact times uncertainty, from 1 to 25. High starts at 15. Try it: the sliders are live.
          </p>
        </div>
        <div ref={ref} className="flex justify-center md:col-span-7 md:justify-end" data-reveal="fade" style={{ ["--d" as string]: "120ms" }}>
          <RiskControl key={seen ? "play" : "idle"} autoplay={seen} />
        </div>
      </div>
    </section>
  );
}
