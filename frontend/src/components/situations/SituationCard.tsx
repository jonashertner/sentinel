import { clsx } from "clsx";
import { PRIORITY_LABELS, COUNTRY_NAMES } from "@/lib/constants";
import type { Situation } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

interface SituationCardProps {
  situation: Situation;
  onClick?: () => void;
}

export function SituationCard({ situation, onClick }: SituationCardProps) {
  const priority = PRIORITY_LABELS[situation.priority];

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-sentinel-border bg-sentinel-surface p-3.5 text-left hover:border-sentinel-text-muted hover:bg-sentinel-surface-hover"
    >
      {/* Priority + status */}
      <div className="flex items-center justify-between">
        <span
          className={clsx(
            "text-[10px] font-bold uppercase tracking-wider",
            priority.color,
          )}
        >
          {situation.priority} - {priority.label}
        </span>
        <span className="text-[10px] tabular-nums text-sentinel-text-muted">
          {situation.events.length} events
        </span>
      </div>

      {/* Title */}
      <div className="mt-2 text-[13px] font-semibold leading-snug text-sentinel-text">
        {situation.title}
      </div>

      {/* Summary truncated */}
      <div className="mt-1.5 text-[11px] leading-relaxed text-sentinel-text-secondary">
        {situation.summary.slice(0, 100)}...
      </div>

      {/* Disease badges */}
      <div className="mt-2.5 flex flex-wrap gap-1">
        {situation.diseases.map((d) => (
          <Badge key={d} label={d} />
        ))}
      </div>

      {/* Countries */}
      <div className="mt-2 flex flex-wrap gap-1">
        {situation.countries.map((cc) => (
          <span
            key={cc}
            className="inline-flex items-center rounded border border-sentinel-border-subtle bg-sentinel-bg px-1.5 py-0.5 font-mono text-[9px] text-sentinel-text-muted"
          >
            {cc}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-sentinel-border-subtle pt-2.5">
        <span className="text-[10px] text-sentinel-text-muted">
          {situation.lead_analyst}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-sentinel-text-muted">
          {situation.updated.slice(0, 10)}
        </span>
      </div>
    </button>
  );
}
