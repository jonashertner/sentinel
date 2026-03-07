"use client";

import { useState, useEffect } from "react";
import { loadSituations } from "@/lib/api";
import type { Situation } from "@/lib/types";
import { SituationBoard } from "@/components/situations/SituationBoard";
import { useI18n } from "@/lib/i18n";

export default function SituationsPage() {
  const { t } = useI18n();
  const [situations, setSituations] = useState<Situation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSituations()
      .then(setSituations)
      .catch(() => setSituations([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-sentinel-border pl-14 pr-4 sm:px-6 md:px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sentinel-text">
            {t("situations.title").toUpperCase()}
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            {t("situations.subtitle")}
          </p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-sentinel-text-muted">
          {loading ? `${t("loading.situations")}…` : `${situations.length} ${t("situations.count")}`}
        </span>
      </header>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[12px] text-sentinel-text-muted">
            {t("loading.situations")}…
          </div>
        ) : (
          <SituationBoard situations={situations} />
        )}
      </div>
    </div>
  );
}
