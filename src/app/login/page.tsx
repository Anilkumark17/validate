"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { TopBar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Hint, Input, Label } from "@/components/ui/form";
import { api } from "@/lib/api";
import type { Me } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const params = useSearchParams();
  const prefill = params.get("email") ?? "";
  const [mode, setMode] = useState<"login" | "signup">(params.get("signup") ? "signup" : "login");
  const router = useRouter();
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: (v: Record<string, string>) => api<Me>(`/auth/${mode}`, { method: "POST", json: v }),
    onSuccess: (me) => {
      qc.setQueryData(["me"], me);
      qc.removeQueries({ queryKey: ["projects"] });
      router.replace("/projects");
    },
  });
  const signup = mode === "signup";
  return (
    <>
      <TopBar />
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-sm flex-col justify-center px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{signup ? "Create your account" : "Sign in to Validate"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {signup ? "Turn an idea into the assumptions worth testing, then test them with customers." : "Pick up where you left off."}
        </p>
        <form
          className="mt-6 space-y-4 rounded-lg border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            submit.mutate(f);
          }}
        >
          {signup && (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={60} autoComplete="name" autoFocus />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" autoFocus={!signup} defaultValue={prefill} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={signup ? 8 : 1}
              autoComplete={signup ? "new-password" : "current-password"}
              aria-describedby={signup ? "pw-hint" : undefined}
            />
            {signup && <Hint id="pw-hint">At least 8 characters.</Hint>}
          </div>
          {submit.error && (
            <p className="text-sm text-destructive" role="alert">
              {submit.error.message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submit.isPending}>
            {submit.isPending ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {signup ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4"
            onClick={() => {
              submit.reset();
              setMode(signup ? "login" : "signup");
            }}
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </main>
    </>
  );
}
