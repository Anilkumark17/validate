const POINTS = [
  { title: "Interview-grounded avatars", body: "Every profile is built from what participants actually said." },
  { title: "Continuous understanding", body: "Each new interview adds to what you know, instead of starting a new document." },
  { title: "Conversations with AI customers", body: "Ask follow-up questions long after the interview ended." },
  { title: "Faster concept and campaign testing", body: "Get a first read on a message in minutes, then confirm it with real people." },
  { title: "Insights tied to evidence", body: "Trace any insight back to the interview it came from." },
];

export function Why() {
  return (
    <section id="faq" aria-labelledby="why-h" className="mx-auto grid max-w-[1600px] gap-12 px-[var(--margin)] py-24 md:grid-cols-12 md:py-32">
      <h2 id="why-h" className="lp-serif text-[length:var(--step-head)] md:sticky md:top-24 md:col-span-5 md:self-start" data-reveal>
        Move from customer conversations to customer intelligence.
      </h2>
      <ul className="md:col-span-7">
        {POINTS.map((p, i) => (
          <li key={p.title} className="grid gap-1 border-t border-white/10 py-6 last:border-b md:grid-cols-[2.5rem_1fr]" data-reveal style={{ ["--d" as string]: `${i * 60}ms` }}>
            <span className="lp-num text-[length:var(--step-small)] text-[var(--accent)]">0{i + 1}</span>
            <div>
              <h3 className="text-[length:var(--step-lead)] font-medium leading-snug">{p.title}</h3>
              <p className="lp-soft mt-1.5">{p.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
