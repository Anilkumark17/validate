import { Mark } from "@/components/app-shell";
import { AccountLink, PrimaryAction } from "./auth-links";
import { RiskChip } from "./chip";
import { Magnetic } from "./magnetic";

/** The sentence is the layout. One live piece of the product stands where a word would be. */
export function Hero() {
  return (
    <header className="relative flex min-h-[100svh] flex-col px-[var(--margin)] pb-[var(--margin)]">
      <nav aria-label="Primary" className="flex items-center justify-between gap-6 py-6">
        <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Validate home">
          <Mark /> <span className="text-[length:var(--step-lead)]">Validate</span>
        </a>
        <div className="flex items-center gap-6 text-[length:var(--step-body)]">
          <a href="#roadmap" className="lp-textlink hidden sm:inline">Roadmap</a>
          <a href="#faq" className="lp-textlink hidden sm:inline">Questions</a>
          <AccountLink className="lp-textlink" />
        </div>
      </nav>

      <div id="top" className="flex flex-1 flex-col justify-center py-14">
        <h1 className="lp-serif text-[clamp(2.75rem,9.4vw,11.5rem)]">
          <span className="lp-mask"><span>Price every <RiskChip /> bet</span></span>
          <span className="lp-mask"><span style={{ ["--d" as string]: "130ms" }}>before you build.</span></span>
        </h1>
      </div>

      <div className="grid items-end gap-8 md:grid-cols-12">
        <p className="lp-up max-w-[40ch] text-[length:var(--step-lead)] leading-snug md:col-span-6" style={{ ["--d" as string]: "500ms" }}>
          Your roadmap is a stack of bets. Validate shows which ones rest on a guess, sends you to the customers who can prove it, and keeps the evidence for every decision.
        </p>
        <div className="lp-up flex flex-wrap items-center gap-x-7 gap-y-4 md:col-span-6 md:justify-end" style={{ ["--d" as string]: "560ms" }}>
          <Magnetic>
            <PrimaryAction className="lp-btn" />
          </Magnetic>
          <a href="#roadmap" className="lp-textlink font-medium">Watch a roadmap get priced</a>
        </div>
      </div>
    </header>
  );
}
