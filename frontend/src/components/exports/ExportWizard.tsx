"use client";

import { useState, useMemo } from "react";
import { clsx } from "clsx";
import {
  Download,
  FileText,
  FileJson,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react";
import type { HealthEvent, Situation } from "@/lib/types";
import { Button } from "@/components/ui/Button";

type ExportScope = "events" | "situations" | "report";
type ExportFormat = "csv" | "json" | "markdown";

interface ExportWizardProps {
  events: HealthEvent[];
  situations: Situation[];
  report: string;
}


function sanitizeCell(value: string): string {
  if (value && "=+-@\t\r".includes(value[0])) return `'${value}`;
  return value;
}

function eventsToCsv(events: HealthEvent[]): string {
  const headers = [
    "id",
    "source",
    "title",
    "date_reported",
    "disease",
    "pathogen",
    "countries",
    "regions",
    "species",
    "case_count",
    "death_count",
    "risk_score",
    "risk_category",
    "swiss_relevance",
    "confidence_score",
    "probability_score",
    "impact_score",
    "operational_priority",
    "ims_activation",
    "lead_agency",
    "decision_window_hours",
    "trigger_flags",
    "recommended_actions",
    "hazard_class",
    "playbook",
    "playbook_sla_hours",
    "sla_timer_hours",
    "escalation_level",
    "escalation_workflow",
    "merged_from",
    "source_evidence_count",
    "provenance_hash",
    "analyst_overrides_count",
    "one_health_tags",
    "summary",
  ];

  const rows = events.map((e) =>
    [
      sanitizeCell(e.id),
      e.source,
      `"${sanitizeCell(e.title).replace(/"/g, '""')}"`,
      e.date_reported,
      sanitizeCell(e.disease),
      sanitizeCell(e.pathogen || ""),
      e.countries.join(";"),
      e.regions.join(";"),
      e.species,
      e.case_count ?? "",
      e.death_count ?? "",
      e.risk_score,
      e.risk_category,
      e.swiss_relevance,
      e.confidence_score,
      e.probability_score,
      e.impact_score,
      e.operational_priority,
      e.ims_activation,
      e.lead_agency,
      e.decision_window_hours,
      e.trigger_flags.join(";"),
      e.recommended_actions.join(";"),
      e.hazard_class,
      e.playbook,
      e.playbook_sla_hours,
      e.sla_timer_hours,
      e.escalation_level,
      e.escalation_workflow.join(";"),
      e.merged_from.join(";"),
      e.source_evidence.length,
      sanitizeCell(e.provenance_hash),
      e.analyst_overrides.length,
      e.one_health_tags.join(";"),
      `"${sanitizeCell(e.summary).replace(/"/g, '""')}"`,
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportWizard({ events, situations, report }: ExportWizardProps) {
  const DATES = useMemo(() => {
    const dateSet = new Set(events.map((e) => e.date_reported));
    return [...dateSet].sort();
  }, [events]);

  const [step, setStep] = useState(1);
  const [scope, setScope] = useState<ExportScope>("events");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Initialize date range once DATES are available
  const effectiveDateFrom = dateFrom || (DATES.length > 0 ? DATES[0] : "");
  const effectiveDateTo = dateTo || (DATES.length > 0 ? DATES[DATES.length - 1] : "");
  const [minRisk, setMinRisk] = useState(0);
  const [selectedSituations, setSelectedSituations] = useState<Set<string>>(
    new Set(situations.map((s) => s.id)),
  );

  // Available formats per scope
  const availableFormats: Record<ExportScope, ExportFormat[]> = {
    events: ["csv", "json"],
    situations: ["json"],
    report: ["markdown"],
  };

  // Reset format when scope changes
  const setValidScope = (s: ExportScope) => {
    setScope(s);
    if (!availableFormats[s].includes(format)) {
      setFormat(availableFormats[s][0]);
    }
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.date_reported >= effectiveDateFrom &&
        e.date_reported <= effectiveDateTo &&
        e.risk_score >= minRisk,
    );
  }, [events, effectiveDateFrom, effectiveDateTo, minRisk]);

  // Selected situations
  const filteredSituations = useMemo(
    () => situations.filter((s) => selectedSituations.has(s.id)),
    [situations, selectedSituations],
  );

  // Generate export content
  const exportContent = useMemo(() => {
    if (scope === "events") {
      if (format === "csv") return eventsToCsv(filteredEvents);
      return JSON.stringify(filteredEvents, null, 2);
    }
    if (scope === "situations") {
      return JSON.stringify(filteredSituations, null, 2);
    }
    return report || "# Daily Report\n\nNo report data available.";
  }, [scope, format, filteredEvents, filteredSituations, report]);

  // Preview (first few lines)
  const preview = useMemo(() => {
    const lines = exportContent.split("\n");
    return lines.slice(0, 20).join("\n") +
      (lines.length > 20 ? `\n... (${lines.length - 20} more lines)` : "");
  }, [exportContent]);

  const handleDownload = () => {
    const ext = format === "csv" ? "csv" : format === "json" ? "json" : "md";
    const mime =
      format === "csv"
        ? "text/csv"
        : format === "json"
          ? "application/json"
          : "text/markdown";
    const filename = `sentinel-export-${scope}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    downloadBlob(exportContent, filename, mime);
  };

  const toggleSituation = (id: string) => {
    const next = new Set(selectedSituations);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSituations(next);
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Step indicator */}
      <div className="mb-6 sm:mb-8 flex items-center justify-center gap-1.5 sm:gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setStep(s)}
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
                step === s
                  ? "bg-sentinel-text text-sentinel-bg"
                  : step > s
                    ? "bg-sentinel-clear text-white"
                    : "border border-sentinel-border text-sentinel-text-muted",
              )}
            >
              {step > s ? <Check className="h-3 w-3" /> : s}
            </button>
            <span
              className={clsx(
                "text-[11px] font-medium hidden sm:inline",
                step === s
                  ? "text-sentinel-text"
                  : "text-sentinel-text-muted",
              )}
            >
              {s === 1 ? "Scope" : s === 2 ? "Format" : "Preview"}
            </span>
            {s < 3 && (
              <div className="mx-1 sm:mx-2 h-px w-6 sm:w-12 bg-sentinel-border" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Scope */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
            Select what to export
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                {
                  value: "events",
                  label: "Events",
                  desc: "Health events data",
                  icon: FileSpreadsheet,
                },
                {
                  value: "situations",
                  label: "Situations",
                  desc: "Situation reports",
                  icon: FileJson,
                },
                {
                  value: "report",
                  label: "Daily Report",
                  desc: "Markdown report",
                  icon: FileText,
                },
              ] as const
            ).map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setValidScope(value)}
                className={clsx(
                  "rounded-lg border p-4 text-left",
                  scope === value
                    ? "border-sentinel-text bg-sentinel-surface-active"
                    : "border-sentinel-border bg-sentinel-surface hover:border-sentinel-text-muted",
                )}
              >
                <Icon
                  className={clsx(
                    "h-5 w-5 mb-2",
                    scope === value
                      ? "text-sentinel-text"
                      : "text-sentinel-text-muted",
                  )}
                  strokeWidth={1.5}
                />
                <div className="text-[12px] font-semibold text-sentinel-text">
                  {label}
                </div>
                <div className="mt-0.5 text-[10px] text-sentinel-text-muted">
                  {desc}
                </div>
              </button>
            ))}
          </div>

          {/* Scope-specific options */}
          {scope === "events" && (
            <div className="mt-4 space-y-3 rounded-lg border border-sentinel-border bg-sentinel-surface p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                Filter Events
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] text-sentinel-text-muted mb-1">
                    From
                  </label>
                  <select
                    value={effectiveDateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded border border-sentinel-border bg-sentinel-bg px-2 py-1.5 text-[11px] text-sentinel-text outline-none"
                  >
                    {DATES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-sentinel-text-muted mb-1">
                    To
                  </label>
                  <select
                    value={effectiveDateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded border border-sentinel-border bg-sentinel-bg px-2 py-1.5 text-[11px] text-sentinel-text outline-none"
                  >
                    {DATES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-sentinel-text-muted mb-1">
                    Min Risk: {minRisk}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={minRisk}
                    onChange={(e) => setMinRisk(Number(e.target.value))}
                    className="w-full accent-sentinel-text"
                  />
                </div>
              </div>
              <div className="text-[10px] tabular-nums text-sentinel-text-muted">
                {filteredEvents.length} events match criteria
              </div>
            </div>
          )}

          {scope === "situations" && (
            <div className="mt-4 space-y-2 rounded-lg border border-sentinel-border bg-sentinel-surface p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                Select Situations
              </div>
              {situations.map((sit) => (
                <label
                  key={sit.id}
                  className="flex items-center gap-2.5 rounded px-2 py-1.5 text-[11px] text-sentinel-text-secondary cursor-pointer hover:bg-sentinel-surface-hover"
                >
                  <input
                    type="checkbox"
                    checked={selectedSituations.has(sit.id)}
                    onChange={() => toggleSituation(sit.id)}
                    className="accent-sentinel-text"
                  />
                  {sit.title}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Format */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
            Select export format
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                {
                  value: "csv",
                  label: "CSV",
                  desc: "Comma-separated values",
                  icon: FileSpreadsheet,
                },
                {
                  value: "json",
                  label: "JSON",
                  desc: "Structured data",
                  icon: FileJson,
                },
                {
                  value: "markdown",
                  label: "Markdown",
                  desc: "Formatted report",
                  icon: FileText,
                },
              ] as const
            )
              .filter(({ value }) =>
                availableFormats[scope].includes(value),
              )
              .map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setFormat(value)}
                  className={clsx(
                    "rounded-lg border p-4 text-left",
                    format === value
                      ? "border-sentinel-text bg-sentinel-surface-active"
                      : "border-sentinel-border bg-sentinel-surface hover:border-sentinel-text-muted",
                  )}
                >
                  <Icon
                    className={clsx(
                      "h-5 w-5 mb-2",
                      format === value
                        ? "text-sentinel-text"
                        : "text-sentinel-text-muted",
                    )}
                    strokeWidth={1.5}
                  />
                  <div className="text-[12px] font-semibold text-sentinel-text">
                    {label}
                  </div>
                  <div className="mt-0.5 text-[10px] text-sentinel-text-muted">
                    {desc}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Step 3: Preview & Download */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Preview
            </div>
            <div className="flex items-center gap-2 text-[10px] text-sentinel-text-muted">
              <span className="rounded bg-sentinel-surface px-1.5 py-0.5 font-mono uppercase">
                {scope}
              </span>
              <span className="rounded bg-sentinel-surface px-1.5 py-0.5 font-mono uppercase">
                {format}
              </span>
              <span className="tabular-nums">
                {exportContent.split("\n").length} lines
              </span>
            </div>
          </div>

          <div className="overflow-auto rounded-lg border border-sentinel-border bg-sentinel-bg">
            <pre className="p-4 font-mono text-[10px] leading-relaxed text-sentinel-text-secondary whitespace-pre-wrap">
              {preview}
            </pre>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={handleDownload}
            className="w-full"
          >
            <Download className="h-4 w-4" />
            Download Export
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between border-t border-sentinel-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </Button>
        {step < 3 && (
          <Button size="sm" onClick={() => setStep(step + 1)}>
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
