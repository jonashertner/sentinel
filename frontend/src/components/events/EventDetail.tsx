"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { HealthEvent } from "@/lib/types";
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
