import { PrimaryAction } from "./auth-links";

export function FinalCta() {
  return (
    <section id="price" aria-labelledby="cta-h" className="mx-auto max-w-[1600px] px-[var(--margin)] py-24 text-center md:py-36">
      <h2 id="cta-h" className="lp-serif mx-auto max-w-[12em] text-[clamp(2.75rem,7vw,7rem)]" data-reveal>
        Turn interviews into decisions.
      </h2>
      <p className="lp-soft mx-auto mt-6 max-w-[48ch] text-[length:var(--step-lead)] leading-snug" data-reveal>
        Test ideas before you build. Start with your first interview.
      </p>
      <div className="mt-10" data-reveal>
        <PrimaryAction className="lp-btn">Start with your first interview</PrimaryAction>
      </div>
      <p className="mt-14 font-medium" data-reveal>Validate — Capture evidence. Test ideas. Decide with confidence.</p>
    </section>
  );
}
