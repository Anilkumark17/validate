"use client";
import Link from "next/link";
import { useState } from "react";
import { AVATARS, type Avatar } from "./data";

/** Three sample profiles. Interview quotes and model inferences are shown in separate, labelled blocks. */
export function Avatars() {
  const [open, setOpen] = useState<string>(AVATARS[0]!.id);
  return (
    <section aria-labelledby="av-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 md:py-32">
      <p className="lp-soft text-[length:var(--step-small)]" data-reveal>Meet your AI customer avatars</p>
      <h2 id="av-h" className="lp-serif mt-3 max-w-[13em] text-[length:var(--step-head)]" data-reveal>
        Not generic personas. Customer profiles built from real conversations.
      </h2>

      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--step-small)]" aria-label="Legend" data-reveal>
        <li className="flex items-center gap-2"><Badge kind="evidence" /> said by a participant</li>
        <li className="flex items-center gap-2"><Badge kind="inferred" /> pattern the model inferred</li>
      </ul>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {AVATARS.map((a, i) => (
          <Card key={a.id} a={a} open={open === a.id} onOpen={() => setOpen(a.id)} delay={i * 90} />
        ))}
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-5" data-reveal>
        <Link href="/login?signup=1" className="lp-btn">Talk to an AI Customer</Link>
        <p className="lp-soft text-[length:var(--step-small)]">Sample profiles. Names and quotes are illustrative.</p>
      </div>
    </section>
  );
}

function Badge({ kind }: { kind: "evidence" | "inferred" }) {
  return kind === "evidence" ? (
    <span className="rounded-md bg-[var(--accent)]/15 px-2 py-0.5 text-[0.75rem] font-medium text-[var(--accent)]">Interview evidence</span>
  ) : (
    <span className="rounded-md border border-dashed border-white/30 px-2 py-0.5 text-[0.75rem] font-medium lp-soft">Inferred</span>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="lp-soft text-[length:var(--step-small)]">{title}</h4>
      <ul className="mt-1.5 space-y-1">
        {items.map((x) => (
          <li key={x} className="flex gap-2"><span aria-hidden className="mt-2.5 size-1 flex-none rounded-full bg-[var(--accent)]" />{x}</li>
        ))}
      </ul>
    </div>
  );
}

function Card({ a, open, onOpen, delay }: { a: Avatar; open: boolean; onOpen: () => void; delay: number }) {
  return (
    <article
      className={`rounded-[var(--radius)] border bg-[var(--surface)] p-7 transition-colors ${open ? "border-[var(--accent)]" : "border-white/10"}`}
      data-reveal
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      <div className="flex items-center gap-4">
        <span aria-hidden className="lp-serif grid size-14 flex-none place-items-center rounded-full bg-[var(--accent)]/20 text-[1.75rem] text-[var(--accent)]">{a.initials}</span>
        <div>
          <h3 className="font-medium leading-snug">{a.tag}</h3>
          <p className="lp-soft text-[length:var(--step-small)]">{a.name}</p>
        </div>
      </div>
      <p className="lp-soft mt-4">{a.background}</p>

      <div className="mt-5 space-y-5">
        <List title="Goals" items={a.goals} />
        <List title="Pain points" items={a.pains} />
        {open && (
          <div className="lp-fade-in space-y-5">
            <List title="Buying motivations" items={a.motivations} />
            <div>
              <h4 className="flex items-center gap-2 text-[length:var(--step-small)]"><span className="lp-soft">Behavioral traits</span> <Badge kind="inferred" /></h4>
              <ul className="mt-1.5 space-y-1 border-l border-dashed border-white/30 pl-3">
                {a.traits.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="flex items-center gap-2 text-[length:var(--step-small)]"><span className="lp-soft">From the interviews</span> <Badge kind="evidence" /></h4>
              <ul className="mt-2 space-y-3">
                {a.evidence.map((e) => (
                  <li key={e.quote} className="rounded-lg bg-[var(--accent)]/10 p-3">
                    <q className="block">{e.quote}</q>
                    <span className="lp-soft mt-1 block text-[length:var(--step-small)]">{e.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      <button onClick={onOpen} aria-expanded={open} className="lp-textlink mt-6 text-[length:var(--step-small)] font-medium text-[var(--accent)]" hidden={open}>
        Show motivations, traits and evidence
      </button>
    </article>
  );
}
