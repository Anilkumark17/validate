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
  side?: "center" | "right" | "left";
}) {
  const sheet = side !== "center";
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col border bg-card shadow-lg outline-none",
          side === "center" && "left-1/2 top-1/2 max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg p-6",
          side === "right" && "right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-y-0 border-r-0",
          side === "left" && "left-0 top-0 h-full w-72 overflow-y-auto border-y-0 border-l-0",
          className,
        )}
      >
        <div className={cn(sheet && "sticky top-0 z-10 border-b bg-card px-5 py-4")}>
          <D.Title className="pr-8 text-base font-semibold leading-6">{title}</D.Title>
          {description ? (
            <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
        </div>
        <div className={cn(sheet ? "px-5 py-4" : "mt-5")}>{children}</div>
        <D.Close aria-label="Close" className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
