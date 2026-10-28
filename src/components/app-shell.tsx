"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={mounted && resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

/** The product mark: a ticked box. The tick takes the one data hue. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("size-6 shrink-0", className)}>
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.6 12.6l3 3 5.8-7" stroke="var(--chart)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-md font-semibold tracking-tight", className)}>
      <Mark />
      <span className="text-base">Validate</span>
    </Link>
  );
}

/** Name, email and sign out. Sits at the foot of the sidebar. */
export function UserRow() {
  const { data } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const out = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.clear();
      router.replace("/login");
    },
  });
  if (!data) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-border text-xs font-medium" aria-hidden>
        {data.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-4">{data.name}</span>
        <span className="block truncate text-xs leading-4 text-muted-foreground">{data.email}</span>
      </span>
      <Button variant="ghost" size="icon" className="size-8" aria-label="Sign out" disabled={out.isPending} onClick={() => out.mutate()}>
        <LogOut />
      </Button>
    </div>
  );
}

/** Plain bar for pages without the sidebar (sign in, setup, invites). */
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-8">
        <Brand />
        <div className="ml-auto flex items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** Flat grey bars at the real size of the content that will land, no shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-border/70", className)} aria-hidden />;
}

export function PageState({ loading, error, empty, emptyText }: { loading?: boolean; error?: string | null; empty?: boolean; emptyText?: string }) {
  if (loading) {
    return (
      <div role="status" className="space-y-3 py-2">
        <span className="sr-only">Loading</span>
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14 w-2/3" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-card p-4 text-sm" role="alert">
        <span className="font-medium text-destructive">Couldn&apos;t load this.</span> {error}
      </div>
    );
  }
  if (empty) {
    return <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{emptyText ?? "Nothing here yet."}</div>;
  }
  return null;
}
