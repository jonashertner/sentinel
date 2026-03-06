"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Situation, SituationStatus } from "@/lib/types";
import { SituationCard } from "./SituationCard";

const COLUMNS: { status: SituationStatus; label: string; color: string }[] = [
  { status: "ESCALATED", label: "Escalated", color: "bg-sentinel-critical" },
  { status: "ACTIVE", label: "Active", color: "bg-sentinel-high" },
  { status: "WATCH", label: "Watch", color: "bg-sentinel-medium" },
  { status: "RESOLVED", label: "Resolved", color: "bg-sentinel-resolved" },
];

interface SituationBoardProps {
  situations: Situation[];
}

export function SituationBoard({ situations }: SituationBoardProps) {
  const router = useRouter();

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4">
      {COLUMNS.map(({ status, label, color }) => {
        const items = situations.filter((s) => s.status === status);
        return (
          <div
            key={status}
            className="flex w-80 shrink-0 flex-col rounded-lg border border-sentinel-border bg-sentinel-bg"
          >
            {/* Column header */}
            <div className="flex items-center gap-2.5 border-b border-sentinel-border px-4 py-3">
              <span className={clsx("h-2 w-2 rounded-full", color)} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text">
                {label}
              </span>
              <span className="ml-auto rounded bg-sentinel-surface px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sentinel-text-muted">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
              {items.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-[11px] text-sentinel-text-muted">
                  No situations
                </div>
              ) : (
                items.map((sit) => (
                  <SituationCard
                    key={sit.id}
                    situation={sit}
                    onClick={() => router.push(`/situations/${sit.id}`)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
