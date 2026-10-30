import { Mark } from "@/components/app-shell";
import { AccountLink, PrimaryAction } from "./auth-links";
import { HeroArt } from "./hero-art";
import { HeroForm } from "./hero-form";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#roadmap", label: "Product" },
  { href: "#price", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

/** Centered statement, one email field, line art underneath. */
export function Hero() {
  return (
    <header className="relative flex flex-col px-[var(--margin)]">
      <nav aria-label="Primary" className="flex items-center justify-between gap-6 py-6">
        <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Validate home">
          <Mark /> <span className="text-[length:var(--step-lead)]">Validate</span>
        </a>
        <div className="flex items-center gap-5 text-[length:var(--step-small)] sm:text-[length:var(--step-body)]">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="lp-textlink hidden md:inline">{l.label}</a>
          ))}
          <AccountLink className="lp-textlink" />
          <a href="#how" className="lp-btn-ghost lp-btn-sm hidden sm:inline-flex">See how it works</a>
          <PrimaryAction className="lp-btn lp-btn-sm">Start for free</PrimaryAction>
        </div>
      </nav>

      <div id="top" className="mx-auto flex max-w-[1100px] flex-col items-center gap-9 pb-10 pt-[clamp(2.5rem,8svh,6rem)] text-center">
        <h1 className="lp-serif text-[clamp(3rem,8.4vw,8rem)]">
          <span className="lp-mask"><span>Where product teams</span></span>
          <span className="lp-mask">
            <span style={{ ["--d" as string]: "110ms" }}>
              <span className="lp-scribble">test ideas</span> and
            </span>
          </span>
          <span className="lp-mask"><span style={{ ["--d" as string]: "220ms" }}>make decisions.</span></span>
        </h1>
        <p className="lp-up lp-soft max-w-[46ch] text-[length:var(--step-lead)] leading-snug" style={{ ["--d" as string]: "420ms" }}>
          Validate shows which roadmap bets rest on a guess, runs the customer interviews that test them, and keeps the evidence for every decision.
        </p>
        <div className="lp-up w-full" style={{ ["--d" as string]: "500ms" }}>
          <HeroForm />
          <p className="lp-soft mt-4 text-[length:var(--step-small)]">Free to start. No card needed.</p>
        </div>
      </div>

      <div className="lp-up -mx-[var(--margin)] overflow-hidden" style={{ ["--d" as string]: "650ms" }}>
        <HeroArt />
      </div>
    </header>
  );
}
