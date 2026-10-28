const QA: [string, string][] = [
  ["How is this different from my roadmap tool?", "A roadmap tool tracks what you will build and when. Validate tracks what has to be true first, and keeps the evidence for each belief next to the decision."],
  ["Can the AI make the call for me?", "No. It drafts assumptions and interview guides to save you the blank page. You score each belief, run the interviews, and write every verdict yourself."],
  ["Does it invent customer evidence?", "Never. Generated stakeholders are kinds of people, not names. Evidence is only what you or your team record, and it is kept apart from the assumption and from any AI text."],
  ["How do I run the interviews?", "Create a five-act guide for a role, start a live call from the Meetings tab, and share the invite link. Guests join with a name and no account, and the transcript is written as people speak."],
  ["What does a stakeholder see?", "The reason behind each verdict and the evidence it rests on, in a history nobody can edit. That replaces the slide you rebuild before every review."],
  ["Who can see my project?", "Only you. A project belongs to your account, and a guest reaches only the meeting they were invited to."],
];

/** Filled tiles, one open at a time. The open tile takes the accent. */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-h" className="mx-auto grid max-w-[1600px] gap-10 px-[var(--margin)] py-24 md:grid-cols-12 md:gap-6 md:py-[16svh]">
      <h2 id="faq-h" className="lp-serif text-[length:var(--step-head)] md:sticky md:top-24 md:col-span-4 md:self-start" data-reveal>
        What PMs ask first.
      </h2>
      <div className="lp-faq space-y-2 md:col-span-8" data-reveal style={{ ["--d" as string]: "100ms" }}>
        {QA.map(([q, a], i) => (
          <details
            key={q}
            name="faq"
            open={i === 0}
            className="group rounded-[var(--radius)] bg-[var(--surface)] open:bg-[var(--accent)] open:text-[var(--accent-ink)]"
          >
            <summary className="flex min-h-[76px] cursor-pointer items-center justify-between gap-4 px-6 py-3 text-[length:var(--step-lead)] font-medium leading-snug max-md:min-h-16 max-md:px-5 max-md:text-[18px]">
              {q}
              <span className="lp-plus" aria-hidden />
            </summary>
            <p className="max-w-[54ch] px-6 pb-6 text-[length:var(--step-body)] leading-[1.5] max-md:px-5">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
