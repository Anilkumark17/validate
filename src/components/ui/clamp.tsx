"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Long text starts at three lines with a Show more toggle, so a screen scans before it reads. */
export function Clamp({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 150;
  return (
    <div className={className}>
      <p className={cn("whitespace-pre-wrap", long && !open && "line-clamp-3")}>{text}</p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
