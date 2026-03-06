import { Eye, Trash2 } from "lucide-react";
import { RISK_COLORS } from "@/lib/constants";
import type { HealthEvent, Watchlist } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { RiskPill } from "@/components/ui/RiskPill";

interface WatchlistCardProps {
  watchlist: Watchlist;
  matchingEvents: HealthEvent[];
  isCustom?: boolean;
  onDelete?: () => void;
}

export function WatchlistCard({
  watchlist,
  matchingEvents,
  isCustom,
  onDelete,
}: WatchlistCardProps) {
  const topEvents = matchingEvents
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 3);

  const maxRisk =
    matchingEvents.length > 0
      ? matchingEvents.reduce((max, e) =>
          e.risk_score > max.risk_score ? e : max,
        ).risk_category
      : null;

  return (
    <div className="rounded-lg border border-sentinel-border bg-sentinel-surface p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-sentinel-text-muted" strokeWidth={1.5} />
          <span className="text-[13px] font-semibold text-sentinel-text">
            {watchlist.name}
          </span>
          {isCustom && (
            <span className="rounded bg-sentinel-surface-active px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Custom
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {maxRisk && (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: RISK_COLORS[maxRisk].dot }}
            />
          )}
          <span className="text-lg font-semibold tabular-nums text-sentinel-text">
            {matchingEvents.length}
          </span>
          <span className="text-[10px] text-sentinel-text-muted">matches</span>
          {isCustom && onDelete && (
            <button
              onClick={onDelete}
              className="ml-2 text-sentinel-text-muted hover:text-sentinel-critical"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Criteria */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {watchlist.diseases.length > 0 &&
          watchlist.diseases.map((d) => (
            <Badge key={d} label={d} />
          ))}
        {watchlist.countries.length > 0 &&
          watchlist.countries.map((cc) => (
            <span
              key={cc}
              className="inline-flex rounded border border-sentinel-border bg-sentinel-bg px-1.5 py-0.5 font-mono text-[9px] text-sentinel-text-muted"
            >
              {cc}
            </span>
          ))}
        {watchlist.one_health_tags.length > 0 &&
          watchlist.one_health_tags.map((t) => (
            <Badge key={t} label={t} />
          ))}
        <span className="inline-flex rounded border border-sentinel-border bg-sentinel-bg px-1.5 py-0.5 text-[9px] tabular-nums text-sentinel-text-muted">
          Risk &ge; {watchlist.min_risk_score}
        </span>
      </div>

      {/* Top matching events */}
      {topEvents.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-sentinel-border-subtle pt-3">
          {topEvents.map((evt) => (
            <div
              key={evt.id}
              className="flex items-center justify-between gap-2 rounded bg-sentinel-bg px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Badge label={evt.source} variant="source" />
                <span className="truncate text-[11px] text-sentinel-text-secondary">
                  {evt.title}
                </span>
              </div>
              <RiskPill
                score={evt.risk_score}
                category={evt.risk_category}
                className="shrink-0"
              />
            </div>
          ))}
          {matchingEvents.length > 3 && (
            <div className="text-center text-[10px] text-sentinel-text-muted">
              +{matchingEvents.length - 3} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
