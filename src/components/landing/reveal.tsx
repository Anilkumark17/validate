"use client";
import { useEffect } from "react";

/**
 * Entrance for the parts of each section. Elements already on the first screen stay put; the rest
 * start hidden once this runs and rise as they scroll in, once. Without script nothing is hidden.
 */
export function RevealController() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>(".lp [data-reveal]")];
    const vh = window.innerHeight;
    const later = els.filter((el) => el.getBoundingClientRect().top > vh * 0.92);
    later.forEach((el) => el.classList.add("pre"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).classList.remove("pre");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    later.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
