import Link from "next/link";
import { Mark } from "@/components/app-shell";
import { AccountLink } from "./auth-links";

const COLS = [
  { title: "Product", links: [["#how", "How it works"], ["#roadmap", "Use cases"], ["#faq", "Why Validate"], ["#price", "Early access"]] },
  ] as const;

export function Footer() {
  return (
    <footer className="mx-auto mt-[12svh] max-w-[1600px] border-t border-white/10 px-[var(--margin)] pb-8 pt-12 text-[length:var(--step-small)]">
      <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight">
            <Mark /> <span className="text-[length:var(--step-lead)]">Validate</span>
          </a>
          <p className="lp-soft mt-3 max-w-[32ch]">Understand people. Test ideas. Build better products.</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="flex flex-col gap-2">
            <span className="font-medium">{c.title}</span>
            {c.links.map(([href, label]) => (
              <a key={href} href={href} className="lp-textlink lp-soft">{label}</a>
            ))}
          </nav>
        ))}
        <nav aria-label="Account" className="flex flex-col gap-2">
          <span className="font-medium">Account</span>
          <AccountLink className="lp-textlink lp-soft" />
          <Link href="/login?signup=1" className="lp-textlink lp-soft">Create an account</Link>
        </nav>
      </div>
      <p className="lp-soft mt-12">© 2026 Validate</p>
    </footer>
  );
}
