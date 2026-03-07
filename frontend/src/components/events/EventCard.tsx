"use client";

import { clsx } from "clsx";
import { RISK_COLORS, VERIFICATION_STYLES } from "@/lib/constants";
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
      <div className="flex items-start gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">
        {/* Left: Risk Pill */}
        <RiskPill
          score={event.risk_score}
          category={event.risk_category}
          className="shrink-0 mt-0.5"
        />

        {/* Center: Title, Disease, Countries, Summary */}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] sm:text-[13px] font-semibold leading-tight text-sentinel-text">
            {event.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <SourceBadge source={event.source} className="sm:hidden" />
            {event.verification_status && (
              <span
                className={clsx(
                  "inline-flex items-center rounded border border-current/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                  VERIFICATION_STYLES[event.verification_status]?.color || "text-sentinel-text-muted",
                  VERIFICATION_STYLES[event.verification_status]?.bg || "bg-sentinel-surface",
                )}
              >
                {VERIFICATION_STYLES[event.verification_status]?.label || event.verification_status}
              </span>
            )}
            <Badge label={event.disease} variant="tag" />
            {event.playbook && (
              <span className="inline-flex items-center rounded border border-sentinel-border bg-sentinel-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                {event.playbook.split("_").join(" ")}
              </span>
            )}
            {event.analyst_overrides.length > 0 && (
              <span className="inline-flex items-center rounded border border-sentinel-border bg-sentinel-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                Analyst Override
              </span>
            )}
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
          <p className="mt-1 text-[10px] text-sentinel-text-muted">
            SLA {event.playbook_sla_hours}h • Escalation {event.escalation_level.replace("_", " ")}
          </p>
          {event.one_health_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.one_health_tags.map((tag) => (
                <Badge key={tag} label={tag} variant="tag" />
              ))}
            </div>
          )}
          {/* Mobile: inline meta row */}
          <div className="mt-2 flex items-center gap-3 sm:hidden">
            <span className="text-[10px] text-sentinel-text-muted">
              {event.date_reported}
            </span>
            <span
              className={clsx(
                "text-[12px] font-mono font-bold tabular-nums",
                event.swiss_relevance >= 8
                  ? "text-sentinel-critical"
                  : event.swiss_relevance >= 6
                    ? "text-sentinel-high"
                    : event.swiss_relevance >= 4
                      ? "text-sentinel-medium"
                      : "text-sentinel-low",
              )}
            >
              CH {event.swiss_relevance.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Right: Source, Swiss Relevance, Date — hidden on mobile */}
        <div className="hidden sm:flex shrink-0 flex-col items-end gap-2">
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
