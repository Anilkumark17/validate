"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/auth";

/** Email capture: carries the address to the sign-up form. Signed in visitors get a direct link instead. */
export function HeroForm() {
  const { data } = useMe();
  const router = useRouter();
  const [email, setEmail] = useState("");

  if (data) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/projects" className="lp-btn">Open your projects</Link>
        <a href="#how" className="lp-btn-ghost">See how it works</a>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <form
        className="lp-pillform"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/login?signup=1${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`);
        }}
      >
        <label htmlFor="hero-email" className="sr-only">Email</label>
        <input id="hero-email" type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="lp-btn">Start for free</button>
      </form>
      <a href="#how" className="lp-btn-ghost">See how it works</a>
    </div>
  );
}
