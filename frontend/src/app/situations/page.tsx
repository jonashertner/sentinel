"use client";

import { useState, useEffect } from "react";
import { loadSituations } from "@/lib/api";
import type { Situation } from "@/lib/types";
import { SituationBoard } from "@/components/situations/SituationBoard";

export default function SituationsPage() {
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
      <header className="flex shrink-0 items-center justify-between border-b border-sentinel-border px-4 sm:px-6 py-3 pt-12 md:pt-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sentinel-text">
            SITUATIONS
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            Active threat situation tracking and management
          </p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-sentinel-text-muted">
          {loading ? "Loading..." : `${situations.length} situations`}
        </span>
      </header>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[12px] text-sentinel-text-muted">
            Loading situations...
          </div>
        ) : (
          <SituationBoard situations={situations} />
        )}
      </div>
    </div>
  );
}
