"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { api, type Meeting } from "@/lib/api";
import { EVIDENCE_TYPES, EVIDENCE_TYPE_LABEL, INTERPRETATIONS, STRENGTHS } from "@/lib/board/constants";
import { refreshBoard, type AssumptionDetail, type BoardStakeholder } from "@/lib/board/client";

const today = () => new Date().toISOString().slice(0, 10);

/** Manual evidence entry. Nothing here claims research happened unless a person records it. */
export function EvidenceForm({
  projectId,
  assumptionId,
  stakeholders,
  onSaved,
}: {
  projectId: string;
  assumptionId: string;
  stakeholders: BoardStakeholder[];
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const meetings = useQuery({ queryKey: ["meetings", projectId], queryFn: () => api<Meeting[]>(`/projects/${projectId}/meetings`) });
  const [nonce, setNonce] = useState(0);
  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => api<AssumptionDetail>(`/projects/${projectId}/assumptions/${assumptionId}/evidence`, { method: "POST", json: v }),
    onSuccess: () => {
      toast.success("Evidence recorded");
      refreshBoard(qc, projectId);
      setNonce((n) => n + 1);
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      key={nonce}
      className="space-y-3 rounded-lg border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save.mutate({
          type: f.get("type"),
          interpretation: f.get("interpretation"),
          strength: f.get("strength"),
          researchedOn: f.get("researchedOn"),
          source: String(f.get("source") ?? ""),
          summary: String(f.get("summary") ?? ""),
          reference: String(f.get("reference") ?? "") || null,
          stakeholderId: String(f.get("stakeholderId") ?? "") || null,
          meetingId: String(f.get("meetingId") ?? "") || null,
        });
      }}
    >
      <h3 className="text-sm font-medium">Record evidence</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ev-type">Type</Label>
          <Select id="ev-type" name="type" defaultValue="interview">
            {EVIDENCE_TYPES.map((t) => (
              <option key={t} value={t}>{EVIDENCE_TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ev-date">Research date</Label>
          <Input id="ev-date" name="researchedOn" type="date" required defaultValue={today()} max={today()} />
        </div>
        <div>
          <Label htmlFor="ev-interp">What it shows</Label>
          <Select id="ev-interp" name="interpretation" defaultValue="inconclusive">
            {INTERPRETATIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ev-strength">Strength</Label>
          <Select id="ev-strength" name="strength" defaultValue="moderate">
            {STRENGTHS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ev-stake">Stakeholder role (optional)</Label>
          <Select id="ev-stake" name="stakeholderId" defaultValue="">
            <option value="">None</option>
            {stakeholders.map((s) => (
              <option key={s.id} value={s.id}>{s.roleName}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ev-meeting">Meeting (optional)</Label>
          <Select id="ev-meeting" name="meetingId" defaultValue="">
            <option value="">None</option>
            {(meetings.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="ev-source">Source or research activity</Label>
        <Input id="ev-source" name="source" maxLength={200} placeholder="Interview 3 with a parent of two" />
      </div>
      <div>
        <Label htmlFor="ev-summary">Observation or summary</Label>
        <Textarea id="ev-summary" name="summary" required minLength={10} maxLength={3000} rows={3} placeholder="What was observed or said, in the participant's terms." />
      </div>
      <div>
        <Label htmlFor="ev-ref">Reference (link or note, optional)</Label>
        <Input id="ev-ref" name="reference" maxLength={500} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save evidence"}
        </Button>
      </div>
    </form>
  );
}
