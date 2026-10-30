const PROBLEMS = [
  { title: "Customer insights get lost", body: "Interviews happen, but valuable insights remain scattered across recordings, transcripts, and documents." },
  { title: "Personas are often assumptions", body: "Traditional personas capture demographics but fail to represent actual customer motivations and behavior." },
  { title: "Testing ideas takes time and money", body: "Testing every advertisement, product concept, and marketing message with real customers is expensive and slow." },
];

export function Problem() {
  return (
    <section aria-labelledby="problem-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 md:py-32">
      <h2 id="problem-h" className="lp-serif max-w-[11em] text-[length:var(--step-head)]" data-reveal>
        You talk to customers. But do you really understand them?
      </h2>
      <ul className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius)] border border-white/10 bg-white/10 md:grid-cols-3">
        {PROBLEMS.map((p, i) => (
          <li key={p.title} className="bg-[var(--surface)] p-8" data-reveal style={{ ["--d" as string]: `${i * 90}ms` }}>
            <span className="lp-num text-[length:var(--step-small)] text-[var(--accent)]">0{i + 1}</span>
            <h3 className="mt-6 text-[length:var(--step-lead)] font-medium leading-snug">{p.title}</h3>
            <p className="lp-soft mt-3">{p.body}</p>
          </li>
        ))}
      </ul>
      <p className="lp-serif mt-16 max-w-[18em] text-[length:var(--step-title)] text-[var(--accent)]" data-reveal>
        What if every customer conversation could become a customer you could learn from?
      </p>
    </section>
  );
}
