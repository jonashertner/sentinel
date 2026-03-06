import { clsx } from "clsx";
import { RISK_COLORS } from "@/lib/constants";
import type { HealthEvent } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { RiskPill } from "@/components/ui/RiskPill";

interface TimelineProps {
  events: HealthEvent[];
}

export function Timeline({ events }: TimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.date_reported).getTime() - new Date(b.date_reported).getTime(),
  );

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-sentinel-border" />

      <div className="space-y-0">
        {sorted.map((evt, i) => {
          const color = RISK_COLORS[evt.risk_category].dot;
          const showDate =
            i === 0 || sorted[i - 1].date_reported !== evt.date_reported;

          return (
            <div key={evt.id}>
              {showDate && (
                <div className="relative flex items-center gap-3 pb-2 pt-4">
                  <div className="z-10 flex h-[23px] w-[23px] items-center justify-center rounded-full bg-sentinel-surface">
                    <div className="h-2 w-2 rounded-full bg-sentinel-text-muted" />
                  </div>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                    {evt.date_reported}
                  </span>
                </div>
              )}
              <div className="relative ml-[23px] border-l border-sentinel-border-subtle pl-5 pb-4">
                {/* Dot */}
                <div
                  className="absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full border-2 border-sentinel-surface"
                  style={{ backgroundColor: color }}
                />
                <div className="rounded-lg border border-sentinel-border bg-sentinel-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge label={evt.source} variant="source" />
                    <RiskPill
                      score={evt.risk_score}
                      category={evt.risk_category}
                    />
                  </div>
                  <div className="mt-2 text-[12px] font-medium leading-snug text-sentinel-text">
                    {evt.title}
                  </div>
                  <div className="mt-1.5 text-[11px] leading-relaxed text-sentinel-text-secondary">
                    {evt.summary}
                  </div>
                  {(evt.case_count !== null || evt.death_count !== null) && (
                    <div className="mt-2 flex gap-4 text-[10px] tabular-nums text-sentinel-text-muted">
                      {evt.case_count !== null && (
                        <span>Cases: {evt.case_count.toLocaleString()}</span>
                      )}
                      {evt.death_count !== null && (
                        <span>Deaths: {evt.death_count.toLocaleString()}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
