"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, FileUp, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/form";
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

export function ImportDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const imp = useMutation({
    mutationFn: (v: { title: string; content: string }) =>
      api<Meeting & { segmentCount: number }>(`/projects/${projectId}/meetings/import`, { method: "POST", json: v }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["meetings", projectId] });
      setOpen(false);
      setContent("");
      toast.success(`Imported ${m.segmentCount} lines. Analyzing now.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp /> Import transcript
        </Button>
      </DialogTrigger>
      <DialogContent title="Import transcript" description="Paste or upload VTT, SRT, or plain text. Use “Speaker: text” lines when you can.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            imp.mutate({ title: String(f.get("title")), content });
          }}
        >
          <div>
            <Label htmlFor="imp-title">Title</Label>
            <Input id="imp-title" name="title" required maxLength={160} placeholder="Interview 4, Marcus" />
          </div>
          <div>
            <Label htmlFor="imp-file">File</Label>
            <Input
              id="imp-file"
              type="file"
              accept=".vtt,.srt,.txt,text/plain"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setContent(await file.text());
              }}
            />
          </div>
          <div>
            <Label htmlFor="imp-text">Transcript</Label>
            <Textarea
              id="imp-text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={9}
              className="font-mono text-xs"
              placeholder={"Interviewer: How do you plan dinners today?\nPriya: Honestly I wing it every night."}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={imp.isPending || !content.trim()}>
              {imp.isPending ? "Importing…" : "Import and analyze"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
