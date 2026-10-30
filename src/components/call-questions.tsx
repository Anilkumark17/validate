"use client";
import Link from "next/link";
import { useState } from "react";
import { useAsked, type Guide } from "@/components/questions/guide-view";
import { Select } from "@/components/ui/form";

/** Host-only panel inside the call: the interview guide, with a checklist for what was already asked. */
export function CallQuestions({ projectId, guides }: { projectId: string; guides: Guide[] }) {
  const [id, setId] = useState(guides[0]?.id ?? "");
  const guide = guides.find((g) => g.id === id) ?? guides[0];
  const { asked, toggle } = useAsked(`call:${guide?.id ?? "none"}`);

  if (!guide) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        No interview guide yet. Create one in the{" "}
        <Link href={`/p/${projectId}/questions`} className="underline" target="_blank">question bank</Link>, then reopen this panel.
      </div>
    );
  }
  const total = guide.content.acts.reduce((n, a) => n + a.questions.length, 0);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      {guides.length > 1 && (
        <Select aria-label="Interview guide" value={guide.id} onChange={(e) => setId(e.target.value)}>
          {guides.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </Select>
      )}
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{asked.size}</span> of {total} asked. Only you see this.
      </p>
      {guide.content.acts.map((a) => (
        <section key={a.act}>
          <h3 className="text-sm font-medium">Act {a.act}: {a.name}</h3>
          <p className="text-xs text-muted-foreground">{a.goal}</p>
          <ul className="mt-2 space-y-2">
            {a.questions.map((q, i) => {
              const qid = `${a.act}:${i}`;
              const done = asked.has(qid);
              return (
                <li key={qid} className="rounded-md border p-2">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={done} onChange={() => toggle(qid)} />
                    <span className={done ? "text-muted-foreground line-through" : ""}>{q.text}</span>
                  </label>
                  {q.followUps.length > 0 && !done && (
                    <ul className="ml-6 mt-1 list-disc space-y-0.5 text-xs text-muted-foreground">
                      {q.followUps.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {guide.content.coachNotes.length > 0 && (
        <section>
          <h3 className="text-sm font-medium">Coach notes</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {guide.content.coachNotes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
