import type { Metadata } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@/components/landing/landing.css";
import { Avatars } from "@/components/landing/avatars";
import { Demo } from "@/components/landing/demo";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { RevealController } from "@/components/landing/reveal";
import { UseCases } from "@/components/landing/use-cases";
import { Why } from "@/components/landing/why";
import { Workflow } from "@/components/landing/workflow";

export const metadata: Metadata = {
  title: "Validate: simulate how your customers think",
  description: "Validate turns real customer interviews into AI avatars grounded in evidence, so you can test products, ads and messages before you launch.",
};

export default function Landing() {
  return (
    <div className="lp min-h-svh">
      <RevealController />
      <Hero />
      <main>
        <Problem />
        <Workflow />
        <UseCases />
        <Avatars />
        <Demo />
        <Why />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
