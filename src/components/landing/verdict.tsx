"use client";
import { useState } from "react";

const FIELD = { validated: "#234a8f", invalidated: "#2a2f38" } as const;

/** One control from the product, blown up: the verdict. Operating it swaps the field and a word of the heading. */
export function Verdict() {
  const [v, setV] = useState<keyof typeof FIELD>("validated");
  return (
    <section
      className="relative min-h-[86svh] overflow-hidden text-white transition-colors duration-500 md:h-[80svh]"
      style={{ background: FIELD[v] }}
      aria-labelledby="verdict-h"
    >
      <div className="px-[var(--margin)] pt-14 md:pt-20" data-reveal>
        <h2 id="verdict-h" className="lp-serif text-[length:var(--step-title)]">
          Call it <span key={v} className="lp-fade-in inline-block">{v}.</span>
        </h2>
        <p className="mt-3 max-w-[40ch] text-[length:var(--step-body)] opacity-90">
          Close every bet with a verdict you write yourself. Stakeholders get the reason and the evidence behind it, not a slide.
        </p>
      </div>

      <div data-ui className="mt-10 w-[min(360px,calc(100%-2*var(--margin)))] px-0 md:absolute md:bottom-[var(--margin)] md:left-[var(--margin)] md:mt-0" style={{ marginLeft: "var(--margin)" }} data-reveal>
        <label htmlFor="reason" className="mb-2 block text-[14px] opacity-90">Reason, required to close a bet</label>
        <textarea
          id="reason"
          rows={4}
          defaultValue="Five of six interviewees described skipping a planned dinner in the last two weeks, each with a specific night."
          className="w-full resize-none rounded-md border border-[var(--p-border)] bg-white p-3 text-[15px] leading-6 text-[var(--p-ink)]"
        />
      </div>

      <div data-ui className="mt-10 px-[var(--margin)] pb-12 md:absolute md:bottom-[-6%] md:right-[-9vw] md:mt-0 md:p-0">
        <div className="text-[clamp(34px,10.5vw,64px)] md:text-[clamp(40px,13.4vh,150px)]">
          <p className="mb-[0.18em] pl-[0.12em] text-[0.26em] text-white/80 max-md:text-[length:var(--step-small)]">Verdict</p>
          <div role="radiogroup" aria-label="Verdict" className="inline-flex rounded-[0.5em] bg-white p-[0.16em] text-[var(--p-ink)]">
            {(["validated", "invalidated"] as const).map((k) => {
              const on = v === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setV(k)}
                  className="rounded-[0.38em] px-[0.62em] py-[0.42em] text-[0.62em] font-medium leading-none transition-colors duration-300"
                  style={{ background: on ? FIELD[k] : "transparent", color: on ? "#fff" : "#5b6371" }}
                >
                  {k === "validated" ? "Validated" : "Invalidated"}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
