"use client";
import { useEffect, useRef } from "react";

/** The wrapped action leans a few pixels toward the pointer. Off for reduced motion and touch. */
export function Magnetic({ children, strength = 0.22 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)").matches) return;
    const target = el.firstElementChild as HTMLElement | null;
    if (!target) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const near = Math.hypot(dx, dy) < Math.max(r.width, 120);
      target.style.transform = near ? `translate(${dx * strength}px, ${dy * strength}px)` : "";
    };
    const leave = () => (target.style.transform = "");
    window.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);
  return (
    <span ref={ref} className="inline-block p-3 -m-3">
      {children}
    </span>
  );
}
