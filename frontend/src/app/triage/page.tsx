"use client";

import { useState, useEffect, useMemo } from "react";
import { loadAllEvents } from "@/lib/api";
import type { HealthEvent, RiskCategory, VerificationStatus } from "@/lib/types";
import { SOURCE_LABELS, COUNTRY_NAMES, VERIFICATION_STYLES } from "@/lib/constants";
import { FilterBar } from "@/components/ui/FilterBar";
import type { FilterConfig } from "@/components/ui/FilterBar";
import { EventCard } from "@/components/events/EventCard";
import { EventDetail } from "@/components/events/EventDetail";
import { useI18n } from "@/lib/i18n";

export default function TriagePage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filterSource, setFilterSource] = useState("");
  const [filterDisease, setFilterDisease] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterVerification, setFilterVerification] = useState("");

  useEffect(() => {
    loadAllEvents()
      .then((evts) => {
        setEvents(evts);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const diseases = useMemo(() => {
    const set = new Set(events.map((e) => e.disease));
    return Array.from(set).sort();
  }, [events]);

  const countries = useMemo(() => {
    const set = new Set(events.flatMap((e) => e.countries));
    return Array.from(set).sort();
  }, [events]);

  const sources = useMemo(() => {
    const set = new Set(events.map((e) => e.source));
    return Array.from(set).sort();
  }, [events]);

  const filters: FilterConfig[] = [
    {
      key: "source",
      label: t("triage.source"),
      options: sources.map((s) => ({
        value: s,
        label: SOURCE_LABELS[s]?.short || s,
      })),
      value: filterSource,
    },
    {
      key: "disease",
      label: t("triage.disease"),
      options: diseases.map((d) => ({ value: d, label: d })),
      value: filterDisease,
    },
    {
      key: "risk",
      label: t("triage.riskLevel"),
      options: (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as RiskCategory[]).map(
        (r) => ({ value: r, label: r }),
      ),
      value: filterRisk,
    },
    {
      key: "country",
      label: t("triage.country"),
      options: countries.map((c) => ({
        value: c,
        label: COUNTRY_NAMES[c] || c,
      })),
      value: filterCountry,
    },
    {
      key: "verification",
      label: t("triage.verification"),
      options: (["UNVERIFIED", "PENDING", "CONFIRMED", "REFUTED"] as VerificationStatus[]).map(
        (v) => ({ value: v, label: VERIFICATION_STYLES[v]?.label || v }),
      ),
      value: filterVerification,
    },
  ];

  const activeChips = [
    filterSource && {
      key: "source",
      label: SOURCE_LABELS[filterSource]?.short || filterSource,
    },
    filterDisease && { key: "disease", label: filterDisease },
    filterRisk && { key: "risk", label: filterRisk },
    filterCountry && {
      key: "country",
      label: COUNTRY_NAMES[filterCountry] || filterCountry,
    },
    filterVerification && {
      key: "verification",
      label: VERIFICATION_STYLES[filterVerification]?.label || filterVerification,
    },
  ].filter(Boolean) as { key: string; label: string }[];

  function handleFilterChange(key: string, value: string) {
    switch (key) {
      case "source":
        setFilterSource(value);
        break;
      case "disease":
        setFilterDisease(value);
        break;
      case "risk":
        setFilterRisk(value);
        break;
      case "country":
        setFilterCountry(value);
        break;
      case "verification":
        setFilterVerification(value);
        break;
    }
  }

  function handleChipRemove(key: string) {
    handleFilterChange(key, "");
  }

  const filteredEvents = useMemo(() => {
    return events
      .filter((e) => {
        if (filterSource && e.source !== filterSource) return false;
        if (filterDisease && e.disease !== filterDisease) return false;
        if (filterRisk && e.risk_category !== filterRisk) return false;
        if (filterCountry && !e.countries.includes(filterCountry)) return false;
        if (filterVerification && e.verification_status !== filterVerification) return false;
        return true;
      })
      .sort((a, b) => b.swiss_relevance - a.swiss_relevance);
  }, [events, filterSource, filterDisease, filterRisk, filterCountry, filterVerification]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sentinel-border border-t-sentinel-text" />
          <p className="text-[11px] uppercase tracking-wider text-sentinel-text-muted">
            {t("loading.triage")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-5 pt-4 md:pt-6">
      {/* Header */}
      <div className="flex items-end justify-between pl-12 md:pl-0">
        <div>
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-sentinel-text-muted">
            {t("triage.title")}
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            {filteredEvents.length} {t("triage.subtitle")}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        activeChips={activeChips}
        onChipRemove={handleChipRemove}
      />

      {/* Event List */}
      <div className="space-y-2">
        {filteredEvents.map((event) => (
          <div key={event.id}>
            <EventCard
              event={event}
              expanded={expandedId === event.id}
              onToggle={() =>
                setExpandedId(expandedId === event.id ? null : event.id)
              }
            />
            {expandedId === event.id && <EventDetail event={event} />}
          </div>
        ))}
        {filteredEvents.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[12px] text-sentinel-text-muted">
              {t("triage.noMatch")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
