"use client";

import { useState, useEffect, useMemo } from "react";
import { loadAllEvents } from "@/lib/api";
import type { HealthEvent } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { TrendChart } from "@/components/charts/TrendChart";
import { SourceComparison } from "@/components/charts/SourceComparison";
import { RiskTimeline } from "@/components/charts/RiskTimeline";
import { DiseaseBreakdown } from "@/components/charts/DiseaseBreakdown";

// DATES derived from loaded events in the component

export default function AnalyticsPage() {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllEvents()
      .then((evts) => {
        setEvents(evts);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const DATES = useMemo(() => {
    const dateSet = new Set(events.map((e) => e.date_reported));
    return [...dateSet].sort();
  }, [events]);

  // Disease trends: events per day per disease
  const { trendData, trendDiseases } = useMemo(() => {
    const diseaseSet = new Set(events.map((e) => e.disease));
    const diseases = Array.from(diseaseSet).sort();

    const data = DATES.map((date) => {
      const row: { date: string; [disease: string]: string | number } = { date: date.slice(5) }; // "03-01"
      for (const disease of diseases) {
        row[disease] = events.filter(
          (e) => e.date_reported === date && e.disease === disease,
        ).length;
      }
      return row;
    });

    return { trendData: data, trendDiseases: diseases };
  }, [events, DATES]);

  // Source comparison
  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      map.set(e.source, (map.get(e.source) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([sourceKey, count]) => ({
        sourceKey,
        source: SOURCE_LABELS[sourceKey]?.short || sourceKey,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  // Risk timeline: average risk and swiss relevance per day
  const riskTimelineData = useMemo(() => {
    return DATES.map((date) => {
      const dayEvents = events.filter((e) => e.date_reported === date);
      const avgRisk =
        dayEvents.length > 0
          ? dayEvents.reduce((s, e) => s + e.risk_score, 0) / dayEvents.length
          : 0;
      const avgSwissRelevance =
        dayEvents.length > 0
          ? dayEvents.reduce((s, e) => s + e.swiss_relevance, 0) /
            dayEvents.length
          : 0;
      return {
        date: date.slice(5),
        avgRisk: Math.round(avgRisk * 10) / 10,
        avgSwissRelevance: Math.round(avgSwissRelevance * 10) / 10,
      };
    });
  }, [events, DATES]);

  // Disease breakdown: total events per disease, sorted desc
  const diseaseBreakdownData = useMemo(() => {
    const map = new Map<string, { count: number; maxRisk: number }>();
    for (const e of events) {
      const existing = map.get(e.disease) || { count: 0, maxRisk: 0 };
      existing.count++;
      existing.maxRisk = Math.max(existing.maxRisk, e.risk_score);
      map.set(e.disease, existing);
    }
    return Array.from(map.entries())
      .map(([disease, { count, maxRisk }]) => ({
        disease: disease
          .replace("Avian influenza A(H5N1)", "H5N1 AI")
          .replace("Crimean-Congo haemorrhagic fever", "CCHF")
          .replace("Undiagnosed respiratory illness", "URI")
          .replace("Foot-and-mouth disease", "FMD")
          .replace("African swine fever", "ASF")
          .replace("Rift Valley fever", "RVF")
          .replace("Marburg virus disease", "Marburg")
          .replace("West Nile fever", "WNV"),
        count,
        maxRisk,
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sentinel-border border-t-sentinel-text" />
          <p className="text-[11px] uppercase tracking-wider text-sentinel-text-muted">
            Loading analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6 pt-4 md:pt-6">
      {/* Header */}
      <div className="pl-12 md:pl-0">
        <h1 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-sentinel-text-muted">
          Analytics
        </h1>
        <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
          {DATES.length}-day intelligence analysis — {events.length} total events
        </p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Disease Trends */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-sentinel-border px-5 py-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Disease Trends
            </h2>
            <p className="mt-0.5 text-[10px] text-sentinel-text-muted">
              Events per day by disease
            </p>
          </div>
          <div className="px-4 py-4">
            <TrendChart data={trendData} diseases={trendDiseases} />
          </div>
          {/* Legend */}
          <div className="border-t border-sentinel-border-subtle px-5 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {trendDiseases.map((d, i) => {
              const colors = [
                "#ef4444", "#f97316", "#eab308", "#3b82f6", "#a855f7",
                "#22c55e", "#06b6d4", "#ec4899", "#14b8a6", "#f43f5e",
                "#84cc16", "#6366f1", "#d946ef", "#0ea5e9", "#fb923c",
              ];
              return (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 text-[10px] text-sentinel-text-muted"
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: colors[i % colors.length] }}
                  />
                  {d.replace("Avian influenza A(H5N1)", "H5N1 AI")
                    .replace("Crimean-Congo haemorrhagic fever", "CCHF")
                    .replace("Undiagnosed respiratory illness", "URI")
                    .replace("Foot-and-mouth disease", "FMD")
                    .replace("African swine fever", "ASF")
                    .replace("Rift Valley fever", "RVF")
                    .replace("Marburg virus disease", "Marburg")
                    .replace("West Nile fever", "WNV")}
                </span>
              );
            })}
          </div>
        </Card>

        {/* Source Comparison */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-sentinel-border px-5 py-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Source Comparison
            </h2>
            <p className="mt-0.5 text-[10px] text-sentinel-text-muted">
              Events per intelligence source
            </p>
          </div>
          <div className="px-4 py-4">
            <SourceComparison data={sourceData} />
          </div>
        </Card>

        {/* Risk Timeline */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-sentinel-border px-5 py-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Risk Timeline
            </h2>
            <p className="mt-0.5 text-[10px] text-sentinel-text-muted">
              Average risk score and Swiss relevance per day
            </p>
          </div>
          <div className="px-4 py-4">
            <RiskTimeline data={riskTimelineData} />
          </div>
        </Card>

        {/* Disease Breakdown */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-sentinel-border px-5 py-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Disease Breakdown
            </h2>
            <p className="mt-0.5 text-[10px] text-sentinel-text-muted">
              Total events per disease
            </p>
          </div>
          <div className="px-4 py-4">
            <DiseaseBreakdown data={diseaseBreakdownData} />
          </div>
        </Card>
      </div>
    </div>
  );
}
