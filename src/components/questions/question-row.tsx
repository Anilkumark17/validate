"use client";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function copyText(text: string, done = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(done));
}

/**
 * One interview question. With `asked` it carries a checkbox so the list can be worked through
 * during a call; follow-ups stay folded until needed.
 */
export function QuestionRow({
  text,
  tests,
  followUps = [],
  asked,
  onToggle,
}: {
  text: string;
  tests?: string;
  followUps?: string[];
  asked?: boolean;
  onToggle?: () => void;
}) {
  const checkable = onToggle !== undefined;
  return (
    <li className="flex items-start gap-3 py-3.5">
      {checkable && (
        <button
          type="button"
          role="checkbox"
          aria-checked={!!asked}
          aria-label={asked ? "Mark as not asked" : "Mark as asked"}
          onClick={onToggle}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded border",
            asked ? "border-chart bg-chart text-white" : "border-input bg-card hover:bg-muted",
          )}
        >
          {asked && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] leading-6", asked && "text-muted-foreground")}>{text}</p>
        {tests && <p className="mt-0.5 truncate text-xs text-muted-foreground">Tests: {tests}</p>}
        {followUps.length > 0 && (
          <details className="group mt-1.5">
            <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground">
              <span className="underline underline-offset-2 group-open:hidden">
                {followUps.length} follow-up{followUps.length === 1 ? "" : "s"}
              </span>
              <span className="hidden underline underline-offset-2 group-open:inline">Hide follow-ups</span>
            </summary>
            <ul className="mt-1.5 space-y-1 border-l pl-3 text-sm text-muted-foreground">
              {followUps.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <button
        type="button"
        aria-label="Copy question"
        title="Copy question"
        onClick={() => copyText(text)}
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Copy className="size-3.5" />
      </button>
    </li>
  );
}
