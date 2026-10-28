"use client";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Search, SlidersHorizontal } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { AssumptionDialog } from "@/components/board/assumption-dialog";
import { RiskBadge } from "@/components/board/badges";
import { GenerationNotice } from "@/components/board/generation-notice";
import { moveNeedsDialog, MoveDialog, moveRequest } from "@/components/board/move-dialog";
import { NewAssumptionDialog } from "@/components/board/new-assumption-dialog";
import { RefineDialog } from "@/components/board/refine-dialog";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { RequireAuth } from "@/lib/auth";
import { boardKey, refreshBoard, useBoard, type BoardAssumption, type BoardData, type BoardStakeholder } from "@/lib/board/client";
import { categoryLabel, computeProgress, STATUSES, STATUS_LABEL, type Status } from "@/lib/board/constants";
import { applyFilters, isFiltered, NO_FILTERS, type Filters } from "@/lib/board/filter";
import { ALLOWED } from "@/lib/board/transitions";
import { cn } from "@/lib/utils";

export default function BoardPage() {
  return (
    <RequireAuth>
      <Board />
    </RequireAuth>
  );
}

function Card({
  a,
  stakeholders,
  onOpen,
  overlay,
}: {
  a: BoardAssumption;
  stakeholders: Map<string, BoardStakeholder>;
  onOpen: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: a.id, data: { status: a.status } });
  const names = a.stakeholderIds.map((id) => stakeholders.get(id)?.roleName).filter(Boolean) as string[];
  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      className={cn("rounded-lg border bg-card p-3", isDragging && !overlay && "opacity-40", overlay && "shadow-lg")}
      aria-label={a.title}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="-ml-1 mt-px cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Drag ${a.title}. Space to pick up, arrow keys to move, Space to drop.`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left font-medium leading-5 hover:underline" onClick={onOpen}>
          {a.title}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-5">
        <RiskBadge risk={a.risk} />
        <span className="text-xs text-muted-foreground">
          <span className="num">{a.evidenceCount}</span> evidence
        </span>
        {a.provisional && (
          <span className="text-xs text-warning" title="Depends on an unconfirmed audience">
            Provisional
          </span>
        )}
      </div>
      <p className="mt-1.5 truncate pl-5 text-xs text-muted-foreground">
        {categoryLabel(a.category)}
        {names.length > 0 && ` · ${names.join(", ")}`}
      </p>
    </article>
  );
}

function Column({ status, items, children }: { status: Status; items: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={cn("flex w-72 shrink-0 flex-col rounded-lg bg-muted/70 p-2", isOver && "ring-2 ring-chart")}
      aria-label={`${STATUS_LABEL[status]}, ${items} assumptions`}
    >
      <h2 className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
        {status === "validated" && <span className="size-2 rounded-full bg-chart" aria-hidden />}
        {STATUS_LABEL[status]}
        <span className="num ml-auto text-xs font-normal text-muted-foreground">{items}</span>
      </h2>
      <div className="flex min-h-16 flex-1 flex-col gap-2">{children}</div>
    </section>
  );
}

function Board() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const { data, isLoading, error } = useBoard(projectId);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: string; to: Status } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const stakeholderMap = useMemo(() => new Map((data?.stakeholders ?? []).map((s) => [s.id, s])), [data?.stakeholders]);
  const visible = useMemo(() => applyFilters(data?.assumptions ?? [], filters), [data?.assumptions, filters]);
  const categories = useMemo(() => [...new Set((data?.assumptions ?? []).map((a) => a.category))].sort(), [data?.assumptions]);
  const methods = useMemo(() => [...new Set((data?.assumptions ?? []).map((a) => a.validationMethod).filter(Boolean))].sort(), [data?.assumptions]);

  // Optimistic: the card moves at once. A failed request restores the previous board.
  const quickMove = useMutation({
    mutationFn: ({ a, to }: { a: BoardAssumption; to: Status }) => moveRequest(projectId, a.id, { from: a.status, to }),
    onMutate: async ({ a, to }) => {
      await qc.cancelQueries({ queryKey: boardKey(projectId) });
      const prev = qc.getQueryData<BoardData>(boardKey(projectId));
      qc.setQueryData<BoardData>(boardKey(projectId), (old) => {
        if (!old) return old;
        const assumptions = old.assumptions.map((x) => (x.id === a.id ? { ...x, status: to } : x));
        const by: Partial<Record<Status, number>> = {};
        assumptions.forEach((x) => (by[x.status] = (by[x.status] ?? 0) + 1));
        return { ...old, assumptions, progress: computeProgress(by) };
      });
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey(projectId), ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => refreshBoard(qc, projectId),
  });

  const requestMove = (a: BoardAssumption, to: Status) => {
    if (a.status === to) return;
    if (!ALLOWED[a.status].includes(to)) {
      toast.error(`${STATUS_LABEL[a.status]} cannot move straight to ${STATUS_LABEL[to]}`);
      return;
    }
    if (moveNeedsDialog(a.status, to)) setMoving({ id: a.id, to });
    else quickMove.mutate({ a, to });
  };

  const byId = (id: string | null) => data?.assumptions.find((a) => a.id === id) ?? null;
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const a = byId(String(e.active.id));
    const to = e.over?.id as Status | undefined;
    if (a && to && (STATUSES as readonly string[]).includes(to)) requestMove(a, to);
  };

  if (isLoading || error || !data) {
    return (
      <main>
        <ProjectHeader projectId={projectId} />
        <PageState loading={isLoading} error={error?.message} />
      </main>
    );
  }
  const openA = byId(openId);
  const movingA = moving ? byId(moving.id) : null;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const extraActive = filters.category !== "all" || filters.method !== "all" || filters.status !== "all";

  const select = (label: string, key: keyof Filters, opts: string[][], className = "w-40") => (
    <Select aria-label={label} className={className} value={filters[key]} onChange={(e) => set(key, e.target.value as never)}>
      {opts.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </Select>
  );

  return (
    <main>
      <ProjectHeader projectId={projectId}>
        <RefineDialog projectId={projectId} />
        <NewAssumptionDialog projectId={projectId} stakeholders={data.stakeholders} />
      </ProjectHeader>
      <div className="space-y-4">
        <GenerationNotice projectId={projectId} />
        <div className="flex flex-wrap items-center gap-2" role="search">
          <div className="relative min-w-48 max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search assumptions" className="pl-9" value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search assumptions" />
          </div>
          <div className={cn("flex-wrap items-center gap-2 max-sm:w-full", showMore ? "flex" : "hidden sm:flex")}>
            {select("Risk", "risk", [["all", "All risks"], ["high", "High (15+)"], ["medium", "Medium (8-14)"], ["low", "Low (1-7)"]], "w-40 max-sm:flex-1")}
            {select("Stakeholder", "stakeholder", [["all", "All stakeholders"], ...data.stakeholders.map((s) => [s.id, s.roleName])], "w-48 max-sm:flex-1")}
            {select("Sort", "sort", [["risk", "Highest risk"], ["newest", "Newest"], ["title", "Title"]], "w-40 max-sm:flex-1")}
          </div>
          <Button variant="ghost" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
            <SlidersHorizontal /> <span className="sm:hidden">Filters</span>
            <span className="max-sm:hidden">More filters</span>
            {extraActive && !showMore ? " (on)" : ""}
          </Button>
          {isFiltered(filters) && (
            <Button variant="link" onClick={() => setFilters(NO_FILTERS)}>
              Clear, showing <span className="num">{visible.length}</span> of <span className="num">{data.assumptions.length}</span>
            </Button>
          )}
        </div>
        {showMore && (
          <div className="flex flex-wrap items-center gap-2">
            {select("Category", "category", [["all", "All categories"], ...categories.map((c) => [c, categoryLabel(c)])], "w-52")}
            {select("Method", "method", [["all", "All methods"], ...methods.map((m) => [m, m])], "w-64")}
            {select("Status", "status", [["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])], "w-52")}
          </div>
        )}
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
            {STATUSES.map((s) => {
              const items = visible.filter((a) => a.status === s);
              return (
                <Column key={s} status={s} items={items.length}>
                  {items.map((a) => (
                    <Card key={a.id} a={a} stakeholders={stakeholderMap} onOpen={() => setOpenId(a.id)} />
                  ))}
                  {items.length === 0 && (
                    <p className="grid h-10 place-items-center rounded-md border border-dashed text-xs text-muted-foreground">{isFiltered(filters) ? "No matches" : "Nothing here"}</p>
                  )}
                </Column>
              );
            })}
          </div>
          <DragOverlay>{dragId && byId(dragId) ? <Card a={byId(dragId)!} stakeholders={stakeholderMap} onOpen={() => {}} overlay /> : null}</DragOverlay>
        </DndContext>
      </div>
      {openA && !moving && (
        <AssumptionDialog
          projectId={projectId}
          assumption={openA}
          stakeholders={data.stakeholders}
          onClose={() => setOpenId(null)}
          onMove={(to) => requestMove(openA, to)}
        />
      )}
      {movingA && moving && <MoveDialog projectId={projectId} assumption={movingA} to={moving.to} onClose={() => setMoving(null)} />}
    </main>
  );
}
