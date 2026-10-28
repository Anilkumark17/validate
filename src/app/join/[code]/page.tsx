"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageState, TopBar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { api } from "@/lib/api";
import { GUEST_NAME_KEY } from "@/lib/guest";

interface Invite {
  id: string;
  title: string;
  state: "scheduled" | "live" | "ended";
  scheduledFor: string | null;
  projectName: string;
}


export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["invite", code], queryFn: () => api<Invite>(`/meetings/by-code/${code}`), retry: false });
  useEffect(() => {
    try {
      setName(localStorage.getItem(GUEST_NAME_KEY) ?? "");
    } catch {}
  }, []);

  return (
    <>
      <TopBar />
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-md flex-col justify-center px-4 py-10">
        <PageState loading={isLoading} error={error ? "This invite link is not valid." : null} />
        {data && (
          <div className="rounded-lg border bg-card p-5">
            <p className="text-sm text-muted-foreground">You are invited to a customer interview for {data.projectName}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-8 tracking-tight">{data.title}</h1>
            {data.state === "ended" ? (
              <p className="mt-4 text-sm text-muted-foreground">This meeting has ended.</p>
            ) : (
              <form
                className="mt-5 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setJoinError(null);
                  try {
                    await api("/livekit/token", { method: "POST", json: { inviteCode: code, name: name.trim() } });
                    try {
                      localStorage.setItem(GUEST_NAME_KEY, name.trim());
                    } catch {}
                    router.push(`/m/${data.id}/call`);
                  } catch (err) {
                    setJoinError((err as Error).message);
                  }
                }}
              >
                <div>
                  <Label htmlFor="n">Your name</Label>
                  <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus />
                </div>
                {joinError && <p className="text-sm text-destructive" role="alert">{joinError}</p>}
                <Button type="submit" className="w-full" disabled={!name.trim()}>Join meeting</Button>
                <p className="text-xs text-muted-foreground">Your microphone is transcribed and the text is shared with everyone in the meeting.</p>
              </form>
            )}
          </div>
        )}
      </main>
    </>
  );
}
