"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageState } from "@/components/app-shell";
import { api, ApiRequestError } from "@/lib/api";

export interface Me {
  id: string;
  email: string;
  name: string;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

/** Renders children only for a signed in user. Others go to /login. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, error, isLoading } = useMe();
  const unauth = error instanceof ApiRequestError && error.status === 401;
  useEffect(() => {
    if (unauth) router.replace("/login");
  }, [unauth, router]);
  if (data) return <>{children}</>;
  return <PageState loading={isLoading || unauth} error={!unauth ? error?.message : null} />;
}
