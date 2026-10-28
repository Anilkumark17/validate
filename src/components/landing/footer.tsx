import Link from "next/link";
import { AccountLink } from "./auth-links";

/** One quiet line. The page above has already made its invitation. */
export function Footer() {
  return (
    <footer className="mx-auto mt-[16svh] max-w-[1600px] px-[var(--margin)] pb-6 text-[length:var(--step-small)] md:mt-[20svh]">
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-baseline md:gap-6">
        <p className="lp-soft">Discovery and evidence for product managers</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1">
          <a href="#roadmap" className="lp-textlink">Roadmap</a>
          <a href="#faq" className="lp-textlink">Questions</a>
          <AccountLink className="lp-textlink" />
          <Link href="/login?signup=1" className="lp-textlink">Create an account</Link>
        </nav>
        <p className="lp-soft md:text-right">© 2026 Validate</p>
      </div>
    </footer>
  );
}
