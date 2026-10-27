"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopBar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { api } from "@/lib/api";
import type { Me } from "@/lib/auth";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const router = useRouter();
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: (v: Record<string, string>) => api<Me>(`/auth/${mode}`, { method: "POST", json: v }),
    onSuccess: (me) => {
      qc.setQueryData(["me"], me);
      qc.removeQueries({ queryKey: ["projects"] });
      router.replace("/");
    },
  });
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 py-16">
        <form
          className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            submit.mutate(f);
          }}
        >
          <h1 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h1>
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={60} autoComplete="name" />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : 1}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          {submit.error && <p className="text-sm text-destructive" role="alert">{submit.error.message}</p>}
          <Button type="submit" className="w-full" disabled={submit.isPending}>
            {submit.isPending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              submit.reset();
              setMode(mode === "login" ? "signup" : "login");
            }}
          >
            {mode === "login" ? "No account? Create one" : "Have an account? Sign in"}
          </button>
        </form>
      </main>
    </>
  );
}
