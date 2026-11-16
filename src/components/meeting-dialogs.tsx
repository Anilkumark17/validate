"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Radio, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/form";
import { api, type Meeting } from "@/lib/api";

export function NewMeetingDialog({ projectId, goLive = false, label }: { projectId: string; goLive?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();
  const create = useMutation({
    mutationFn: (v: { title: string; scheduledFor: string | null }) =>
      api<Meeting>(`/projects/${projectId}/meetings`, { method: "POST", json: v }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["meetings", projectId] });
      setOpen(false);
      if (goLive) router.push(`/m/${m.id}/call`);
      else toast.success("Meeting created. Copy the invite link from the list.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={goLive ? "default" : "outline"}>
          {goLive ? <Radio /> : <CalendarPlus />} {label ?? (goLive ? "Start live call" : "New meeting")}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={goLive ? "Start a live call" : "New meeting"}
        description="Everyone with the invite link can join as a guest."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const when = String(f.get("scheduledFor") ?? "");
            create.mutate({ title: String(f.get("title")), scheduledFor: when && !goLive ? new Date(when).toISOString() : null });
          }}
        >
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={160} placeholder="Interview with Priya, parent of two" autoFocus />
          </div>
          {!goLive && (
            <div>
              <Label htmlFor="scheduledFor">Scheduled for (optional)</Label>
              <Input id="scheduledFor" name="scheduledFor" type="datetime-local" />
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : goLive ? "Create and join" : "Create meeting"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Offline meeting notes: upload a .pdf, .txt or .md file and open it like an ended call. */
export function UploadNotesDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();
  const upload = useMutation({
    mutationFn: (form: FormData) => api<Meeting & { segments: number }>(`/projects/${projectId}/meetings/upload`, { method: "POST", body: form }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["meetings", projectId] });
      setOpen(false);
      toast.success(`Notes uploaded (${m.segments} part${m.segments === 1 ? "" : "s"}). Run Extract to get the summary and insights.`);
      router.push(`/m/${m.id}/call`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> Upload notes
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Upload meeting notes"
        description="For a meeting held offline. A .pdf, .txt or .md file up to 5 MB. Lines like “Priya: …” are read as that person speaking."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            upload.mutate(new FormData(e.currentTarget));
          }}
        >
          <div>
            <Label htmlFor="notes-file">File</Label>
            <Input id="notes-file" name="file" type="file" required accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" />
          </div>
          <div>
            <Label htmlFor="notes-title">Title (optional)</Label>
            <Input id="notes-title" name="title" maxLength={160} placeholder="Defaults to the file name" />
          </div>
          <div>
            <Label htmlFor="notes-held">Held on (optional)</Label>
            <Input id="notes-held" name="heldAt" type="date" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
