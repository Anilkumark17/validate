"use client";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const QUESTIONS = [
  "Tell me about the last time you did not know what to cook.",
  "What happened the last time you tried a meal planning tool?",
  "Describe the last time you paid for something that helped with dinner.",
  "Tell me about the last grocery list you made.",
];

/** Fragment one: the interview guide. The checkboxes work. */
function Guide() {
  const [asked, setAsked] = useState<Set<number>>(new Set([0]));
  const toggle = (i: number) =>
    setAsked((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  const acts: [string, number][] = [["Welcome", 2], ["Context", 2], ["Core", 4], ["Wrap-up", 2], ["Unknowns", 1]];
  return (
    <div data-ui className="w-full rounded-lg border border-[var(--p-border)] bg-white p-5 text-[var(--p-ink)] sm:p-6">
      <div className="flex items-center justify-between text-[14px]">
        <p>
          <span className="lp-num font-medium">{asked.size}</span> <span className="text-[var(--p-muted)]">of <span className="lp-num">{QUESTIONS.length}</span> asked</span>
        </p>
        <span className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--p-border)]" aria-hidden>
          <span className="block h-full bg-[var(--p-chart)] transition-[width] duration-300" style={{ width: `${(asked.size / QUESTIONS.length) * 100}%` }} />
        </span>
      </div>
      <div className="mt-4 flex gap-4 overflow-x-auto text-[14px] text-[var(--p-muted)]" aria-hidden>
        {acts.map(([n, c]) => (
          <span key={n} className={`whitespace-nowrap pb-2 ${n === "Core" ? "border-b-2 border-[var(--p-ink)] font-medium text-[var(--p-ink)]" : ""}`}>
            {n} <span className="lp-num">{c}</span>
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-1">
        {QUESTIONS.map((q, i) => {
          const on = asked.has(i);
          return (
            <li key={q} className="flex items-start gap-3 py-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={on ? "Mark as not asked" : "Mark as asked"}
                onClick={() => toggle(i)}
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition-colors ${on ? "border-[var(--p-chart)] bg-[var(--p-chart)] text-white" : "border-[var(--p-input)] bg-white hover:bg-[var(--p-ground)]"}`}
              >
                {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              </button>
              <span className={`text-[15px] leading-6 ${on ? "text-[var(--p-muted)]" : ""}`}>{q}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const LINES: [string, string][] = [
  ["Host", "Walk me through last night, from getting home to the table."],
  ["Guest", "Honestly it was pasta again. I got home at six thirty and had no idea what to make."],
  ["Host", "How often does that happen?"],
  ["Guest", "Maybe four nights out of five. The deciding is the worst part."],
];

/** Fragment two: the live transcript, written as people speak. */
function Transcript() {
  return (
    <div data-ui className="w-full rounded-lg border border-[var(--p-border)] bg-white text-[var(--p-ink)]">
      <p className="flex items-center gap-2 bg-[var(--p-ground)] px-5 py-3 rounded-t-lg text-[14px] font-medium">
        <span className="size-2 rounded-full bg-[var(--p-high)]" aria-hidden /> Live transcript
      </p>
      <ul className="space-y-4 p-5 sm:p-6">
        {LINES.map(([who, text], i) => (
          <li key={text} className="lp-fade-in" style={{ animationDelay: `${i * 140}ms` }}>
            <p className="text-[13px] text-[var(--p-muted)]"><span className="font-medium text-[var(--p-ink)]">{who}</span> · <span className="lp-num">0:{(8 + i * 11 < 10 ? "0" : "") + (8 + i * 11)}</span></p>
            <p className="text-[15px] leading-6">{text}</p>
          </li>
        ))}
        <li className="text-[15px] italic text-[var(--p-muted)]">Guest: I tried a planning app once, paid for three months and…</li>
      </ul>
    </div>
  );
}

/** Fragment three: the decision record with its evidence. */
function Record() {
  return (
    <div data-ui className="w-full space-y-3">
      <div className="rounded-lg border border-[var(--p-border)] bg-white p-5 text-[var(--p-ink)] sm:p-6">
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="inline-flex h-5 items-center rounded-full bg-[#eaedf1] px-2 font-medium text-[var(--p-muted)]">Evidence collected</span>
          <span className="text-[var(--p-muted)]">to</span>
          <span className="inline-flex h-5 items-center rounded-full bg-[var(--p-chart-tint)] px-2 font-medium text-[var(--p-chart-ink)]">Validated</span>
        </p>
        <p className="mt-3 text-[15px] font-medium leading-6">Parents struggle to decide what to cook on weeknights</p>
        <p className="mt-2 text-[15px] leading-6">Five of six interviewees described skipping a planned dinner in the last two weeks, each with a specific night.</p>
        <p className="lp-num mt-3 text-[13px] text-[var(--p-muted)]">Based on 5 evidence records · Oct 14, 10:22</p>
      </div>
      <div className="rounded-lg border border-[var(--p-border)] bg-white p-5 text-[var(--p-ink)] opacity-80 sm:px-6">
        <p className="text-[13px] text-[var(--p-muted)]">Interview · supports · strong</p>
        <p className="mt-1 text-[15px] leading-6">Stands in front of the fridge for ten minutes most evenings with no idea what to cook.</p>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Ask with the guide open.", text: "Five acts, every question about a real past moment. Tick them off as you go, and nothing gets skipped.", view: <Guide /> },
  { title: "Listen while it writes itself.", text: "Everyone speaks in the call and the transcript fills in as they do. No note-taker, no recap email.", view: <Transcript /> },
  { title: "Decide with the evidence in view.", text: "The verdict, the reason and every record behind it, kept together for the next time someone asks.", view: <Record /> },
];

/** A fragment stays put while three short statements change it. On a phone each statement brings its own. */
export function Pinned() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(refs.current.indexOf(e.target as HTMLDivElement))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  return (
    <section aria-labelledby="pin-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 md:py-[140px]">
      <h2 id="pin-h" className="lp-serif max-w-[11em] text-[length:var(--step-head)]" data-reveal>Discovery, in one place.</h2>
      <div className="mt-14 grid gap-10 md:mt-20 md:grid-cols-12 md:gap-8">
        <div className="hidden min-w-0 md:col-span-7 md:block">
          <div className="sticky top-[12vh] flex min-h-[520px] items-center rounded-[var(--radius)] bg-[var(--surface)] p-10 lg:p-14">
            {STEPS.map((s, i) => (
              <div key={s.title} className={`w-full transition-opacity duration-500 ${i === active ? "lp-fade-in" : "hidden"}`} aria-hidden={i !== active}>
                {s.view}
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 md:col-span-5">
          {STEPS.map((s, i) => (
            <div key={s.title} ref={(el) => { refs.current[i] = el; }} className="md:flex md:min-h-[70svh] md:flex-col md:justify-center">
              <h3 className="lp-serif text-[length:var(--step-title)]" data-reveal>{s.title}</h3>
              <p className="mt-3 max-w-[34ch] text-[length:var(--step-body)]" data-reveal style={{ ["--d" as string]: "80ms" }}>{s.text}</p>
              <div className="mt-8 rounded-[var(--radius)] bg-[var(--surface)] p-4 md:hidden">{s.view}</div>
              <div className="h-16 md:hidden" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
