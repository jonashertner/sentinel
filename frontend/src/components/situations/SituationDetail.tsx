"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Send,
} from "lucide-react";
import { PRIORITY_LABELS, COUNTRY_NAMES } from "@/lib/constants";
import type { Situation, HealthEvent, Annotation } from "@/lib/types";
import { loadAllEvents } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Timeline } from "@/components/situations/Timeline";
import { OneHealthMatrix } from "@/components/situations/OneHealthMatrix";

interface SituationDetailProps {
  id: string;
}

export function SituationDetail({ id }: SituationDetailProps) {
  const router = useRouter();
  const [situation, setSituation] = useState<Situation | null>(null);
  const [linkedEvents, setLinkedEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`sentinel-annotations-${id}`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [checkedActions, setCheckedActions] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set<number>();
    try {
      const stored = localStorage.getItem(`sentinel-actions-${id}`);
      return stored ? new Set(JSON.parse(stored) as number[]) : new Set<number>();
    } catch { return new Set<number>(); }
  });

  useEffect(() => {
    // Fetch situation and events
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    Promise.all([
      fetch(`${basePath}/data/situations/${id}.json`).then((r) =>
        r.ok ? r.json() : null,
      ),
      loadAllEvents(),
    ])
      .then(([sit, allEvents]) => {
        setSituation(sit as Situation);
        if (sit) {
          const eventIds = new Set((sit as Situation).events);
          setLinkedEvents(allEvents.filter((e) => eventIds.has(e.id)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const addAnnotation = () => {
    if (!noteText.trim()) return;
    const annotation: Annotation = {
      id: `ann-${Date.now()}`,
      event_id: "",
      author: "Analyst (local)",
      timestamp: new Date().toISOString(),
      type: "NOTE",
      content: noteText.trim(),
      visibility: "INTERNAL",
      risk_override: null,
      status_change: null,
      linked_event_ids: [],
      tags: [],
    };
    const updated = [...localAnnotations, annotation];
    setLocalAnnotations(updated);
    localStorage.setItem(
      `sentinel-annotations-${id}`,
      JSON.stringify(updated),
    );
    setNoteText("");
  };

  const toggleAction = (idx: number) => {
    const next = new Set(checkedActions);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setCheckedActions(next);
    localStorage.setItem(
      `sentinel-actions-${id}`,
      JSON.stringify(Array.from(next)),
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-sentinel-text-muted">
        Loading situation...
      </div>
    );
  }

  if (!situation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="text-[12px] text-sentinel-text-muted">
          Situation not found
        </div>
        <Button size="sm" onClick={() => router.push("/situations")}>
          Back to Situations
        </Button>
      </div>
    );
  }

  const priority = PRIORITY_LABELS[situation.priority];
  const allAnnotations = [...situation.annotations, ...localAnnotations];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-sentinel-border pl-14 pr-4 sm:px-6 py-4">
        <button
          onClick={() => router.push("/situations")}
          className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-sentinel-text-muted hover:text-sentinel-text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Situations
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className={clsx(
                  "text-[10px] font-bold uppercase tracking-wider",
                  priority.color,
                )}
              >
                {situation.priority}
              </span>
              <Badge label={situation.status} variant="risk" />
            </div>
            <h1 className="mt-1.5 text-base sm:text-lg font-semibold leading-tight text-sentinel-text">
              {situation.title}
            </h1>
          </div>
          <div className="shrink-0 sm:text-right text-[10px] text-sentinel-text-muted">
            <div>Lead: {situation.lead_analyst}</div>
            <div className="mt-0.5 font-mono tabular-nums">
              Created {situation.created}
            </div>
            <div className="font-mono tabular-nums">
              Updated {situation.updated.slice(0, 10)}
            </div>
          </div>
        </div>

        {/* Countries + diseases */}
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1">
            {situation.countries.map((cc) => (
              <span
                key={cc}
                className="inline-flex items-center rounded border border-sentinel-border bg-sentinel-surface px-1.5 py-0.5 font-mono text-[9px] text-sentinel-text-secondary"
                title={COUNTRY_NAMES[cc] || cc}
              >
                {cc}
              </span>
            ))}
          </div>
          <div className="h-3 w-px bg-sentinel-border hidden sm:block" />
          <div className="flex flex-wrap items-center gap-1">
            {situation.diseases.map((d) => (
              <Badge key={d} label={d} />
            ))}
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left column */}
        <div className="flex-1 overflow-y-auto border-b lg:border-b-0 lg:border-r border-sentinel-border p-4 sm:p-6 lg:basis-[65%]">
          {/* Timeline */}
          <div>
            <div className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Event Timeline ({linkedEvents.length} events)
            </div>
            {linkedEvents.length > 0 ? (
              <Timeline events={linkedEvents} />
            ) : (
              <div className="py-8 text-center text-[11px] text-sentinel-text-muted">
                No linked events found in loaded data
              </div>
            )}
          </div>

          {/* Annotations */}
          <div className="mt-8 border-t border-sentinel-border pt-6">
            <div className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Annotations ({allAnnotations.length})
            </div>

            {allAnnotations.length > 0 && (
              <div className="mb-4 space-y-2">
                {allAnnotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-lg border border-sentinel-border bg-sentinel-surface p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                        {ann.type}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-sentinel-text-muted">
                        {ann.timestamp.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[12px] text-sentinel-text-secondary">
                      {ann.content}
                    </div>
                    <div className="mt-1.5 text-[10px] text-sentinel-text-muted">
                      {ann.author}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add annotation form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAnnotation()}
                placeholder="Add an annotation..."
                className="flex-1 rounded-md border border-sentinel-border bg-sentinel-surface px-3 py-2 text-[12px] text-sentinel-text placeholder:text-sentinel-text-muted outline-none focus:border-sentinel-text-muted"
              />
              <Button size="sm" onClick={addAnnotation} disabled={!noteText.trim()}>
                <Send className="h-3 w-3" />
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="overflow-y-auto p-4 sm:p-6 lg:basis-[35%]">
          {/* One Health Matrix */}
          <OneHealthMatrix situation={situation} />

          {/* Swiss Impact Assessment */}
          <div className="mt-6">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Swiss Impact Assessment
            </div>
            <div className="rounded-lg border border-sentinel-border bg-sentinel-bg p-3">
              <div className="text-[11px] leading-relaxed text-sentinel-text-secondary">
                {situation.swiss_impact_assessment}
              </div>
            </div>
          </div>

          {/* Recommended Actions */}
          <div className="mt-6">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Recommended Actions
            </div>
            <div className="space-y-1">
              {situation.recommended_actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleAction(idx)}
                  className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-sentinel-surface-hover"
                >
                  {checkedActions.has(idx) ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentinel-clear" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentinel-text-muted" />
                  )}
                  <span
                    className={clsx(
                      "text-[11px] leading-snug",
                      checkedActions.has(idx)
                        ? "text-sentinel-text-muted line-through"
                        : "text-sentinel-text-secondary",
                    )}
                  >
                    {action}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
