"use client";

import { clsx } from "clsx";
import { RISK_COLORS, SOURCE_LABELS } from "@/lib/constants";
import type { HealthEvent } from "@/lib/types";
import { RiskPill } from "@/components/ui/RiskPill";
import { Badge, SourceBadge } from "@/components/ui/Badge";

interface EventCardProps {
  event: HealthEvent;
  expanded: boolean;
  onToggle: () => void;
}

export function EventCard({ event, expanded, onToggle }: EventCardProps) {
  const borderColor = RISK_COLORS[event.risk_category]?.dot || "#71717a";

  return (
    <button
      onClick={onToggle}
      className={clsx(
        "w-full text-left rounded-lg border border-sentinel-border bg-sentinel-surface overflow-hidden",
        "hover:border-sentinel-text-muted",
        expanded && "ring-1 ring-sentinel-text-muted/20",
      )}
      style={{ borderLeftWidth: "3px", borderLeftColor: borderColor }}
    >
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Left: Risk Pill */}
        <RiskPill
          score={event.risk_score}
          category={event.risk_category}
          className="shrink-0 mt-0.5"
        />

        {/* Center: Title, Disease, Countries, Summary */}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight text-sentinel-text">
            {event.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge label={event.disease} variant="tag" />
            {event.countries.map((c) => (
              <span
                key={c}
                className="text-[10px] font-mono font-medium text-sentinel-text-muted"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-sentinel-text-secondary line-clamp-2">
            {event.summary}
          </p>
          {event.one_health_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.one_health_tags.map((tag) => (
                <Badge key={tag} label={tag} variant="tag" />
              ))}
            </div>
          )}
        </div>

        {/* Right: Source, Swiss Relevance, Date */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <SourceBadge source={event.source} />
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              CH Relevance
            </p>
            <p
              className={clsx(
                "text-lg font-mono font-bold tabular-nums",
                event.swiss_relevance >= 8
                  ? "text-sentinel-critical"
                  : event.swiss_relevance >= 6
                    ? "text-sentinel-high"
                    : event.swiss_relevance >= 4
                      ? "text-sentinel-medium"
                      : "text-sentinel-low",
              )}
            >
              {event.swiss_relevance.toFixed(1)}
            </p>
          </div>
          <span className="text-[10px] text-sentinel-text-muted">
            {event.date_reported}
          </span>
        </div>
      </div>
    </button>
  );
}
