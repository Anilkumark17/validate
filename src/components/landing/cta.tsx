"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** A sentence with a blank. The blank is the form: your email, then the last word submits. */
export function Cta() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  return (
    <section className="mx-auto flex min-h-[58svh] max-w-[1600px] flex-col justify-end px-[var(--margin)] pb-16 pt-24 md:pb-[var(--margin)]" aria-labelledby="cta-h">
      <form
        className="text-[clamp(2.5rem,0.8rem+7vw,9rem)]"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/login?signup=1${email ? `&email=${encodeURIComponent(email)}` : ""}`);
        }}
        data-reveal
      >
        <h2 id="cta-h" className="lp-serif" style={{ lineHeight: 1.1 }}>
          Price your next bet{" "}
          <label className="sr-only" htmlFor="cta-email">Your email</label>
          <input
            id="cta-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            autoComplete="email"
            className="mx-[0.06em] inline-block h-[0.95em] w-[4.6em] max-w-full rounded-[0.2em] bg-[var(--surface)] px-[0.25em] align-[-0.12em] text-[1em] text-[var(--ink)] placeholder:text-[var(--muted)]"
            style={{ fontFamily: "inherit", letterSpacing: "-0.01em" }}
          />{" "}
          <button
            type="submit"
            className="inline-block h-[0.95em] rounded-[0.2em] bg-[var(--accent)] px-[0.25em] align-[-0.12em] text-[var(--accent-ink)] transition-transform duration-200 hover:-translate-y-[0.04em] active:scale-[0.98]"
            style={{ fontFamily: "inherit" }}
          >
            now
          </button>
        </h2>
      </form>
      <p className="lp-soft mt-6 text-[length:var(--step-body)]">You set a name and password next. Nothing is sent until you continue.</p>
    </section>
  );
}
