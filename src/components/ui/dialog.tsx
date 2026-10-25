"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  side = "center",
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
  description?: string;
  side?: "center" | "right";
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
      <D.Content
        className={cn(
          "fixed z-50 bg-card shadow-xl border outline-none flex flex-col",
          side === "center"
            ? "left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg p-6 max-h-[90vh] overflow-y-auto"
            : "right-0 top-0 h-full w-full max-w-xl border-l overflow-y-auto",
          className,
        )}
      >
        <div className={cn(side === "right" && "sticky top-0 z-10 bg-card border-b px-6 py-4")}>
          <D.Title className="text-base font-semibold pr-8">{title}</D.Title>
          {description ? (
            <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
        </div>
        <div className={cn(side === "right" ? "px-6 py-4" : "mt-4")}>{children}</div>
        <D.Close aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 hover:bg-muted">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
