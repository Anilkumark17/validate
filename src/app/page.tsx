import type { Metadata } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@/components/landing/landing.css";
import { Board } from "@/components/landing/board";
import { Cta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Pinned } from "@/components/landing/pinned";
import { Price } from "@/components/landing/price";
import { RevealController } from "@/components/landing/reveal";
import { Roadmap } from "@/components/landing/roadmap";
import { Statement } from "@/components/landing/statement";
import { Verdict } from "@/components/landing/verdict";

export const metadata: Metadata = {
  title: "Validate: price every bet before you build",
  description: "Validate shows product managers which roadmap bets rest on a guess, runs the customer interviews that test them, and keeps the evidence for every decision.",
};

export default function Landing() {
  return (
    <div className="lp min-h-svh">
      <RevealController />
      <Hero />
      <main>
        <Statement />
        <Roadmap />
        <Features />
        <Price />
        <Board />
        <Pinned />
        <Verdict />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
