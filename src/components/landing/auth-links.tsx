"use client";
import Link from "next/link";
import { useMe } from "@/lib/auth";

/** The one action on the page. Signed in visitors go straight to their projects. */
export function PrimaryAction({ className, children }: { className?: string; children?: string }) {
  const { data } = useMe();
  return (
    <Link href={data ? "/projects" : "/login?signup=1"} className={className}>
      {data ? "Open your projects" : (children ?? "Start with your idea")}
    </Link>
  );
}

export function AccountLink({ className }: { className?: string }) {
  const { data } = useMe();
  return (
    <Link href={data ? "/projects" : "/login"} className={className}>
      {data ? "Your projects" : "Sign in"}
    </Link>
  );
}
