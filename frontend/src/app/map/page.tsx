"use client";

import { useState, useEffect } from "react";
import { getManifest, loadEvents, loadAllEvents } from "@/lib/api";
import type { HealthEvent } from "@/lib/types";
import { GlobalMap } from "@/components/maps/GlobalMap";
import { useI18n } from "@/lib/i18n";

export default function MapPage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewAll, setViewAll] = useState(true);

  useEffect(() => {
    getManifest()
      .then((manifest) => {
        setAvailableDates(manifest.event_dates);
        setSelectedDate((current) => (
          current || manifest.event_dates[manifest.event_dates.length - 1] || ""
        ));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetcher = viewAll || !selectedDate ? loadAllEvents() : loadEvents(selectedDate);
    fetcher
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [selectedDate, viewAll]);

  const handleDateChange = (date: string) => {
    setLoading(true);
    setSelectedDate(date);
    setViewAll(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-sentinel-border pl-14 pr-4 sm:px-6 md:px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sentinel-text">
            {t("map.title").toUpperCase()}
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            {t("map.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              setViewAll(true);
            }}
            className={`rounded px-3 py-1.5 text-[11px] font-medium ${
              viewAll
                ? "bg-sentinel-text text-sentinel-bg"
                : "text-sentinel-text-muted hover:text-sentinel-text-secondary"
            }`}
          >
            {t("map.allDates")}
          </button>
          <div className="h-4 w-px bg-sentinel-border" />
          <span className="font-mono text-[11px] tabular-nums text-sentinel-text-muted">
            {loading ? `${t("loading.map")}…` : `${events.length} ${t("metric.events")}`}
          </span>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[12px] text-sentinel-text-muted">
            {t("loading.map")}…
          </div>
        ) : (
          <GlobalMap
            events={events}
            selectedDate={selectedDate}
            availableDates={availableDates}
            onDateChange={handleDateChange}
          />
        )}
      </div>
    </div>
  );
}
