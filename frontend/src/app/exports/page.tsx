"use client";

import { useState, useEffect } from "react";
import { loadAllEvents, loadSituations, loadReport } from "@/lib/api";
import type { HealthEvent, Situation } from "@/lib/types";
import { ExportWizard } from "@/components/exports/ExportWizard";

export default function ExportsPage() {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadAllEvents(), loadSituations(), loadReport("2026-03-06")])
      .then(([ev, sit, rep]) => {
        setEvents(ev);
        setSituations(sit);
        setReport(rep);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-sentinel-border px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sentinel-text">
            EXPORTS
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            Export event data, situations, and reports
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-[12px] text-sentinel-text-muted">
            Loading export data...
          </div>
        ) : (
          <ExportWizard
            events={events}
            situations={situations}
            report={report}
          />
        )}
      </div>
    </div>
  );
}
