"use client";

import { useState } from "react";
import { ExternalLink, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { clsx } from "clsx";
import type { HealthEvent } from "@/lib/types";
import { VERIFICATION_STYLES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";

interface EventDetailProps {
  event: HealthEvent;
}

type TriageStatus = "MONITOR" | "ESCALATE" | "DISMISS";

function getStorageKey(eventId: string, type: "status" | "annotation") {
  return `sentinel:${type}:${eventId}`;
}

export function EventDetail({ event }: EventDetailProps) {
  const [status, setStatus] = useState<TriageStatus | null>(() => {
    const stored = localStorage.getItem(getStorageKey(event.id, "status"));
    return stored ? (stored as TriageStatus) : null;
  });
  const [annotation, setAnnotation] = useState(() => {
    return localStorage.getItem(getStorageKey(event.id, "annotation")) || "";
  });
  const [savedAnnotation, setSavedAnnotation] = useState(() => {
    return localStorage.getItem(getStorageKey(event.id, "annotation")) || "";
  });

  function handleStatus(s: TriageStatus) {
    setStatus(s);
    localStorage.setItem(getStorageKey(event.id, "status"), s);
  }

  function handleSaveAnnotation() {
    localStorage.setItem(getStorageKey(event.id, "annotation"), annotation);
    setSavedAnnotation(annotation);
  }

  return (
    <div className="border-t border-sentinel-border-subtle bg-sentinel-bg/50 px-3 sm:px-5 py-4 sm:py-5 space-y-4 sm:space-y-5">
      {/* Verification Status + IHR Annex 2 */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Verification */}
        <div className="sm:w-40 shrink-0">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
            Verification
          </h4>
          {event.verification_status && (
            <span
              className={clsx(
                "inline-flex items-center rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider",
                VERIFICATION_STYLES[event.verification_status]?.color,
                VERIFICATION_STYLES[event.verification_status]?.bg,
              )}
            >
              {VERIFICATION_STYLES[event.verification_status]?.label || event.verification_status}
            </span>
          )}
        </div>

        {/* IHR Annex 2 */}
        <div className="flex-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
            IHR Annex 2 Assessment
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["Unusual / unexpected", event.ihr_unusual],
              ["Serious public health impact", event.ihr_serious_impact],
              ["International spread risk", event.ihr_international_spread],
              ["Trade / travel restriction risk", event.ihr_trade_travel_risk],
            ] as const).map(([label, value]) => {
              const Icon = value === true ? CheckCircle2 : value === false ? XCircle : HelpCircle;
              const color = value === true ? "text-sentinel-critical" : value === false ? "text-sentinel-clear" : "text-sentinel-text-muted";
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className={clsx("h-3.5 w-3.5 shrink-0", color)} />
                  <span className="text-[11px] text-sentinel-text-secondary">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Decision Playbook */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
          Decision Playbook
        </h4>
        <div className="rounded-md border border-sentinel-border-subtle bg-sentinel-surface p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded bg-sentinel-bg px-2 py-1 font-semibold uppercase tracking-wider text-sentinel-text-secondary">
              {event.playbook.split("_").join(" ")}
            </span>
            <span className="text-sentinel-text-muted">Hazard: {event.hazard_class.split("_").join(" ")}</span>
            <span className="text-sentinel-text-muted">SLA: {event.playbook_sla_hours}h</span>
            <span className="text-sentinel-text-muted">Escalation: {event.escalation_level.split("_").join(" ")}</span>
          </div>
          {event.escalation_workflow.length > 0 && (
            <ol className="space-y-1 text-[11px] text-sentinel-text-secondary">
              {event.escalation_workflow.map((step, idx) => (
                <li key={`${event.id}-wf-${idx}`} className="flex gap-1.5">
                  <span className="font-mono text-sentinel-text-muted">{idx + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Provenance Graph */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
          Source Provenance
        </h4>
        <div className="rounded-md border border-sentinel-border-subtle bg-sentinel-surface p-3 space-y-2">
          <div className="text-[11px] text-sentinel-text-muted">
            Graph {event.provenance_hash} • {event.source_evidence.length} source nodes • merged from{" "}
            {event.merged_from.length} event IDs
          </div>
          <div className="space-y-1.5">
            {event.source_evidence.map((evidence) => (
              <div
                key={`${evidence.source}-${evidence.event_id}-${evidence.url}`}
                className="rounded border border-sentinel-border-subtle bg-sentinel-bg px-2 py-1.5"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="font-semibold text-sentinel-text-secondary">{evidence.source}</span>
                  <span className="font-mono text-sentinel-text-muted">{evidence.event_id}</span>
                  <span className="text-sentinel-text-muted">{Math.round(evidence.confidence * 100)}% confidence</span>
                </div>
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate text-[10px] text-sentinel-accent hover:underline"
                >
                  {evidence.title}
                </a>
              </div>
            ))}
          </div>
          {event.analyst_overrides.length > 0 && (
            <div className="text-[10px] text-amber-300">
              {event.analyst_overrides.length} analyst override(s) applied to this event.
            </div>
          )}
        </div>
      </div>

      {/* Full Summary */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
          Summary
        </h4>
        <p className="text-[12px] leading-relaxed text-sentinel-text-secondary">
          {event.summary}
        </p>
      </div>

      {/* Analysis */}
      {event.analysis && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
            LLM Analysis
          </h4>
          <div className="rounded-md border border-sentinel-border-subtle bg-sentinel-surface p-4 text-[12px] leading-relaxed text-sentinel-text-secondary">
            {event.analysis.split("\n").map((para, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {para}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Analyst Overrides */}
      {event.analyst_overrides.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
            Analyst Overrides
          </h4>
          <div className="space-y-1.5">
            {event.analyst_overrides.map((override) => (
              <div
                key={override.annotation_id}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-amber-200">
                  <span className="font-semibold">{override.author}</span>
                  <span className="font-mono">{override.timestamp.slice(0, 16).replace("T", " ")}</span>
                  <span>{override.fields.join(", ")}</span>
                </div>
                {override.note && (
                  <div className="mt-1 text-[11px] text-amber-100/90">{override.note}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
          Triage Actions
        </h4>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={status === "MONITOR" ? "primary" : "secondary"}
            onClick={(e) => {
              e.stopPropagation();
              handleStatus("MONITOR");
            }}
          >
            Monitor
          </Button>
          <Button
            size="sm"
            variant={status === "ESCALATE" ? "primary" : "secondary"}
            onClick={(e) => {
              e.stopPropagation();
              handleStatus("ESCALATE");
            }}
            className={
              status === "ESCALATE"
                ? "!bg-sentinel-critical !text-white"
                : ""
            }
          >
            Escalate
          </Button>
          <Button
            size="sm"
            variant={status === "DISMISS" ? "primary" : "secondary"}
            onClick={(e) => {
              e.stopPropagation();
              handleStatus("DISMISS");
            }}
          >
            Dismiss
          </Button>
          {status && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-sentinel-text-muted ml-2">
              Status: {status}
            </span>
          )}
        </div>
      </div>

      {/* Annotation */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-2">
          Analyst Note
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Add annotation..."
            className="h-8 flex-1 rounded-md border border-sentinel-border bg-sentinel-surface px-3 text-[12px] text-sentinel-text placeholder:text-sentinel-text-muted outline-none focus:border-sentinel-text-muted"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveAnnotation();
            }}
          >
            Save
          </Button>
        </div>
        {savedAnnotation && savedAnnotation === annotation && (
          <p className="mt-1 text-[10px] text-sentinel-clear">Saved</p>
        )}
      </div>

      {/* Source Link */}
      <div>
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sentinel-text-secondary hover:text-sentinel-text"
        >
          <ExternalLink className="h-3 w-3" />
          View Source
        </a>
      </div>
    </div>
  );
}
