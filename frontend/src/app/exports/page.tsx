"use client";

import { useState, useEffect } from "react";
import { loadAllEvents, loadSituations, loadLatestReport } from "@/lib/api";
import type { HealthEvent, Situation } from "@/lib/types";
import { ExportWizard } from "@/components/exports/ExportWizard";
import { useI18n } from "@/lib/i18n";

export default function ExportsPage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadAllEvents(), loadSituations(), loadLatestReport()])
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
      <header className="flex shrink-0 items-center justify-between border-b border-sentinel-border px-4 sm:px-6 py-3 pt-14 md:pt-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sentinel-text">
            {t("exports.title").toUpperCase()}
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            {t("exports.subtitle")}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-[12px] text-sentinel-text-muted">
            {t("loading.exports")}…
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
