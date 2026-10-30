const JOURNEY = ["Real interview", "Customer intelligence", "AI avatar", "Simulated interaction", "Actionable insights"];

const QUESTIONS = [
  "Why would you choose this product?",
  "What would stop you from purchasing?",
  "What do you think about this pricing?",
  "What problem are you trying to solve?",
  "What would make you switch?",
];

const AVATAR_FIELDS = ["Customer background", "Goals and motivations", "Pain points", "Preferences", "Buying behavior", "Decision-making patterns", "Objections and concerns"];

/** Each step carries its own small visual so the pipeline reads without the copy. */
export function Workflow() {
  return (
    <section id="how" aria-labelledby="how-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 md:py-32">
      <h2 id="how-h" className="lp-serif max-w-[10em] text-[length:var(--step-head)]" data-reveal>
        From real conversations to simulated customers.
      </h2>

      <ol aria-label="The path from interview to insight" className="mt-12 flex flex-wrap items-center gap-2 text-[length:var(--step-small)]" data-reveal>
        {JOURNEY.map((j, i) => (
          <li key={j} className="flex items-center gap-2">
            <span className="rounded-full border border-white/15 bg-[var(--surface)] px-3.5 py-1.5">{j}</span>
            {i < JOURNEY.length - 1 && <span aria-hidden className="text-[var(--accent)]">→</span>}
          </li>
        ))}
      </ol>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <Step n="1" title="Conduct Customer Interviews" body="Invite Validate into your customer interviews. It listens to conversations, captures responses, and identifies customer needs, motivations, frustrations, and decision-making patterns.">
          <div className="space-y-2 text-[length:var(--step-small)]">
            <Line who="Interviewer" text="Tell me about the last time you picked a tool like this." />
            <Line who="Customer" text="I compared three, mostly on price. The trial decided it." accent />
            <div className="flex flex-wrap gap-2 pt-1">
              {["Motivation: low risk", "Pain: hidden cost", "Pattern: compares before buying"].map((t) => (
                <span key={t} className="rounded-md bg-[var(--accent)]/15 px-2 py-1 text-[var(--accent)]">{t}</span>
              ))}
            </div>
          </div>
        </Step>

        <Step n="2" title="Build AI Avatars" body="Validate transforms interview insights into individual AI customer profiles grounded in actual conversation evidence.">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[length:var(--step-small)]">
            {AVATAR_FIELDS.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--accent)]" /> {f}
              </li>
            ))}
          </ul>
        </Step>

        <Step n="3" title="Talk to Your AI Customers" body="Interact with AI avatars conversationally. Ask questions like:">
          <ul className="space-y-2 text-[length:var(--step-small)]">
            {QUESTIONS.map((q) => (
              <li key={q} className="w-fit rounded-2xl rounded-bl-sm border border-white/10 bg-[var(--raised)] px-3.5 py-2">{q}</li>
            ))}
          </ul>
        </Step>

        <Step n="4" title="Simulate and Validate" body="Put your ideas in front of your AI customer population. Understand how different customers might respond, what attracts them, what confuses them, and what influences their decisions.">
          <div className="space-y-3 text-[length:var(--step-small)]">
            {[
              ["Attracts", 78],
              ["Confuses", 34],
              ["Raises objections", 52],
            ].map(([label, w]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between"><span>{label}</span></div>
                <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${w}%` }} /></div>
              </div>
            ))}
            <p className="lp-soft">Illustrative bars. They show the kind of output, not measured results.</p>
          </div>
        </Step>
      </div>
    </section>
  );
}

function Step({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="list-none rounded-[var(--radius)] border border-white/10 bg-[var(--surface)] p-7" data-reveal style={{ ["--d" as string]: `${(Number(n) % 2) * 90}ms` }}>
      <div className="flex items-baseline gap-3">
        <span className="lp-serif text-[2.75rem] text-[var(--accent)]">{n}</span>
        <h3 className="text-[length:var(--step-lead)] font-medium leading-snug">Step {n}: {title}</h3>
      </div>
      <p className="lp-soft mt-3 max-w-[56ch]">{body}</p>
      <div className="mt-6 rounded-[10px] border border-white/10 bg-[var(--bg)] p-4">{children}</div>
    </li>
  );
}

function Line({ who, text, accent }: { who: string; text: string; accent?: boolean }) {
  return (
    <p>
      <span className={accent ? "font-medium text-[var(--accent)]" : "lp-soft font-medium"}>{who}: </span>
      {text}
    </p>
  );
}
