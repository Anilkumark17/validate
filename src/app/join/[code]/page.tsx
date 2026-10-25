"use client";
import { useQuery } from "@tanstack/react-query";
import { Video } from "lucide-react";
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
  const { data, isLoading, error } = useQuery({ queryKey: ["invite", code], queryFn: () => api<Invite>(`/meetings/by-code/${code}`), retry: false });
  useEffect(() => {
    try {
      setName(localStorage.getItem(GUEST_NAME_KEY) ?? "");
    } catch {}
  }, []);

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 py-16">
        <PageState loading={isLoading} error={error ? "This invite link is not valid." : null} />
        {data && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Video className="size-5" aria-hidden /></div>
            <p className="text-xs text-muted-foreground">{data.projectName}</p>
            <h1 className="text-xl font-semibold">{data.title}</h1>
            {data.state === "ended" ? (
              <p className="mt-4 text-sm text-muted-foreground">This meeting has ended.</p>
            ) : (
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    localStorage.setItem(GUEST_NAME_KEY, name);
                  } catch {}
                  router.push(`/m/${data.id}/call`);
                }}
              >
                <div>
                  <Label htmlFor="n">Your name</Label>
                  <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus />
                </div>
                <Button type="submit" className="w-full" disabled={!name.trim()}>Join meeting</Button>
                <p className="text-xs text-muted-foreground">Your microphone is transcribed in your browser. Only the text is shared with the team.</p>
              </form>
            )}
          </div>
        )}
      </main>
    </>
  );
}
