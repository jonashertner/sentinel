"use client";

import { useState, useEffect } from "react";
import { loadEvents, loadAllEvents } from "@/lib/api";
import type { HealthEvent } from "@/lib/types";
import { GlobalMap } from "@/components/maps/GlobalMap";

export default function MapPage() {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState("2026-03-06");
  const [loading, setLoading] = useState(true);
  const [viewAll, setViewAll] = useState(true);

  useEffect(() => {
    const fetcher = viewAll ? loadAllEvents() : loadEvents(selectedDate);
    fetcher
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [selectedDate, viewAll]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setViewAll(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-sentinel-border px-4 sm:px-6 py-3 pt-12 md:pt-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sentinel-text">
            GLOBAL THREAT MAP
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            Geographic distribution of health events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewAll(true)}
            className={`rounded px-3 py-1.5 text-[11px] font-medium ${
              viewAll
                ? "bg-sentinel-text text-sentinel-bg"
                : "text-sentinel-text-muted hover:text-sentinel-text-secondary"
            }`}
          >
            All dates
          </button>
          <div className="h-4 w-px bg-sentinel-border" />
          <span className="font-mono text-[11px] tabular-nums text-sentinel-text-muted">
            {loading ? "Loading..." : `${events.length} events`}
          </span>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[12px] text-sentinel-text-muted">
            Loading threat data...
          </div>
        ) : (
          <GlobalMap
            events={events}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
        )}
      </div>
    </div>
  );
}
