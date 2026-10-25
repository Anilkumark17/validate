"use client";
import { BookMarked, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <BookMarked className="size-4" aria-hidden />
      </span>
      Assumption Ledger
    </Link>
  );
}

export function TopBar({ children, crumbs }: { children?: React.ReactNode; crumbs?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-4 px-4 sm:px-6">
        <Brand />
        {crumbs ? <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">{crumbs}</div> : null}
        <div className="ml-auto flex items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function PageState({ loading, error, empty, emptyText }: { loading?: boolean; error?: string | null; empty?: boolean; emptyText?: string }) {
  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground" role="status">Loading…</div>;
  if (error) return <div className="m-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</div>;
  if (empty) return <div className="p-10 text-center text-sm text-muted-foreground">{emptyText ?? "Nothing here yet."}</div>;
  return null;
}
