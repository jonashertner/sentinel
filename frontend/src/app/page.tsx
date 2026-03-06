"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { loadAllEvents, loadSituations } from "@/lib/api";
import type { HealthEvent, Situation, Source } from "@/lib/types";
import { RISK_COLORS, SOURCE_LABELS } from "@/lib/constants";
import { KPICard } from "@/components/ui/KPICard";
import { RiskPill } from "@/components/ui/RiskPill";
import { SourceBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";
import { VERIFICATION_STYLES } from "@/lib/constants";

// DATES derived from loaded events in the component

const WHO_REGION_NAMES: Record<string, string> = {
  EURO: "Europe",
  SEARO: "Southeast Asia",
  AFRO: "Africa",
  AMRO: "Americas",
  EMRO: "Middle East",
  WPRO: "Western Pacific",
};

const REGION_ORDER = [
  "Europe",
  "Southeast Asia",
  "Africa",
  "Americas",
  "Middle East",
  "Western Pacific",
];

const REGION_COLORS: Record<string, string> = {
  Europe: "#3b82f6",
  "Southeast Asia": "#f97316",
  Africa: "#ef4444",
  Americas: "#a855f7",
  "Middle East": "#14b8a6",
  "Western Pacific": "#06b6d4",
};

export default function CommandCenter() {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadAllEvents(), loadSituations()])
      .then(([evts, sits]) => {
        setEvents(evts);
        setSituations(sits);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const DATES = useMemo(() => {
    const dateSet = new Set(events.map((e) => e.date_reported));
    return [...dateSet].sort();
  }, [events]);

  const latestDate = DATES.length > 0 ? DATES[DATES.length - 1] : "";
  const previousDate = DATES.length > 1 ? DATES[DATES.length - 2] : "";

  const todayEvents = useMemo(
    () => events.filter((e) => e.date_reported === latestDate),
    [events, latestDate],
  );

  const criticalCount = useMemo(
    () => todayEvents.filter((e) => e.risk_category === "CRITICAL").length,
    [todayEvents],
  );

  const swissRelevantCount = useMemo(
    () => todayEvents.filter((e) => e.swiss_relevance >= 6.0).length,
    [todayEvents],
  );

  const dailyCounts = useMemo(() => {
    return DATES.map((d) => events.filter((e) => e.date_reported === d).length);
  }, [events, DATES]);

  const priorityEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => b.swiss_relevance - a.swiss_relevance)
      .slice(0, 10);
  }, [events]);

  // "What Changed Overnight" deltas
  const overnightChanges = useMemo(() => {
    const newEvents = events.filter((e) => e.date_reported === latestDate);
    const previousEvents = events.filter((e) => e.date_reported === previousDate);

    // New diseases not seen before latest date
    const previousDiseases = new Set(
      events.filter((e) => e.date_reported !== latestDate).map((e) => e.disease),
    );
    const newDiseases = newEvents
      .map((e) => e.disease)
      .filter((d) => !previousDiseases.has(d));
    const uniqueNewDiseases = [...new Set(newDiseases)];

    // New countries not seen before
    const previousCountries = new Set(
      events.filter((e) => e.date_reported !== latestDate).flatMap((e) => e.countries),
    );
    const newCountries = newEvents
      .flatMap((e) => e.countries)
      .filter((c) => !previousCountries.has(c));
    const uniqueNewCountries = [...new Set(newCountries)];

    // High-priority new events (swiss_relevance >= 4 or risk_score >= 6)
    const escalatedNew = newEvents.filter(
      (e) => e.swiss_relevance >= 4.0 || e.risk_score >= 6.0,
    );

    // Situations that are ESCALATED or ACTIVE
    const activeSituations = situations.filter(
      (s) => s.status === "ESCALATED" || s.status === "ACTIVE",
    );

    return {
      newCount: newEvents.length,
      previousCount: previousEvents.length,
      uniqueNewDiseases,
      uniqueNewCountries,
      escalatedNew,
      activeSituations,
    };
  }, [events, situations, latestDate, previousDate]);

  // Region x Disease matrix
  const threatMatrix = useMemo(() => {
    const regionMap = new Map<
      string,
      {
        region: string;
        diseases: Map<string, { count: number; maxRisk: number }>;
        totalCount: number;
        maxRisk: number;
      }
    >();

    for (const evt of events) {
      for (const rawRegion of evt.regions) {
        const region = WHO_REGION_NAMES[rawRegion] || rawRegion;
        if (!regionMap.has(region)) {
          regionMap.set(region, {
            region,
            diseases: new Map(),
            totalCount: 0,
            maxRisk: 0,
          });
        }
        const r = regionMap.get(region)!;
        r.totalCount++;
        r.maxRisk = Math.max(r.maxRisk, evt.risk_score);

        if (!r.diseases.has(evt.disease)) {
          r.diseases.set(evt.disease, { count: 0, maxRisk: 0 });
        }
        const d = r.diseases.get(evt.disease)!;
        d.count++;
        d.maxRisk = Math.max(d.maxRisk, evt.risk_score);
      }
    }

    const ordered = REGION_ORDER.filter((r) => regionMap.has(r));
    const extras = Array.from(regionMap.keys())
      .filter((r) => !REGION_ORDER.includes(r))
      .sort();
    return [...ordered, ...extras].map((r) => regionMap.get(r)!);
  }, [events]);

  // Unique diseases across all data for matrix columns
  const allDiseases = useMemo(() => {
    const diseaseSet = new Set<string>();
    for (const r of threatMatrix) {
      for (const d of r.diseases.keys()) {
        diseaseSet.add(d);
      }
    }
    return Array.from(diseaseSet).sort();
  }, [threatMatrix]);

  // Disease category sparklines (7 day trend per disease)
  const diseaseTrends = useMemo(() => {
    const diseaseMap = new Map<string, number[]>();
    for (const disease of allDiseases) {
      diseaseMap.set(
        disease,
        DATES.map(
          (d) =>
            events.filter(
              (e) => e.date_reported === d && e.disease === disease,
            ).length,
        ),
      );
    }
    return Array.from(diseaseMap.entries())
      .filter(([, counts]) => counts.some((c) => c > 0))
      .sort((a, b) => {
        const sumA = a[1].reduce((s, v) => s + v, 0);
        const sumB = b[1].reduce((s, v) => s + v, 0);
        return sumB - sumA;
      });
  }, [events, allDiseases, DATES]);

  // Source statistics for transparency panel
  const sourceCounts = useMemo(() => {
    const counts: Record<string, { total: number; latest: string }> = {};
    for (const evt of events) {
      if (!counts[evt.source]) {
        counts[evt.source] = { total: 0, latest: "" };
      }
      counts[evt.source].total++;
      if (evt.date_collected > (counts[evt.source].latest || "")) {
        counts[evt.source].latest = evt.date_collected;
      }
    }
    return counts;
  }, [events]);

  function riskColor(score: number): string {
    if (score >= 8) return RISK_COLORS.CRITICAL.dot;
    if (score >= 6) return RISK_COLORS.HIGH.dot;
    if (score >= 4) return RISK_COLORS.MEDIUM.dot;
    return RISK_COLORS.LOW.dot;
  }

  function riskBg(score: number): string {
    if (score >= 8) return "rgba(239,68,68,0.25)";
    if (score >= 6) return "rgba(249,115,22,0.2)";
    if (score >= 4) return "rgba(234,179,8,0.12)";
    return "rgba(59,130,246,0.08)";
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sentinel-border border-t-sentinel-text" />
          <p className="text-[11px] uppercase tracking-wider text-sentinel-text-muted">
            Loading intelligence data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6 pt-4 md:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pl-12 md:pl-0">
        <div>
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-sentinel-text-muted">
            Command Center
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            Global threat landscape — {latestDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sentinel-clear" />
          <span className="text-[10px] text-sentinel-text-muted">
            Pipeline active — Collecting 06:00 &amp; 18:00 UTC
          </span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          label="New Events (24h)"
          value={todayEvents.length}
          delta={
            todayEvents.length -
            events.filter((e) => e.date_reported === previousDate).length
          }
          sparkData={dailyCounts}
        />
        <KPICard
          label="Active Situations"
          value={situations.length}
          sparkData={[1, 1, 2, 3, 3, 3]}
        />
        <KPICard
          label="Critical Alerts"
          value={criticalCount}
          delta={
            criticalCount -
            events.filter(
              (e) =>
                e.date_reported === previousDate &&
                e.risk_category === "CRITICAL",
            ).length
          }
          sparkData={DATES.map(
            (d) =>
              events.filter(
                (e) =>
                  e.date_reported === d && e.risk_category === "CRITICAL",
              ).length,
          )}
        />
        <KPICard
          label="Swiss-Relevant"
          value={swissRelevantCount}
          delta={
            swissRelevantCount -
            events.filter(
              (e) =>
                e.date_reported === previousDate && e.swiss_relevance >= 6.0,
            ).length
          }
          sparkData={DATES.map(
            (d) =>
              events.filter(
                (e) => e.date_reported === d && e.swiss_relevance >= 6.0,
              ).length,
          )}
        />
      </div>

      {/* What Changed Overnight */}
      {latestDate && (
        <Card className="p-0 overflow-hidden border-sentinel-text-muted/20">
          <div className="border-b border-sentinel-border px-5 py-2.5 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              What Changed — {latestDate}
            </h2>
            <span className="text-[10px] text-sentinel-text-muted">
              vs. {previousDate || "—"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-sentinel-border-subtle">
            {/* New events */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                New Events
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-mono font-bold tabular-nums text-sentinel-text">
                  {overnightChanges.newCount}
                </span>
                {overnightChanges.previousCount > 0 && (
                  <span className="text-[10px] text-sentinel-text-muted">
                    (prev: {overnightChanges.previousCount})
                  </span>
                )}
              </div>
            </div>

            {/* Elevated signals */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                Elevated Signals
              </div>
              <div className="mt-1 space-y-1">
                {overnightChanges.escalatedNew.length > 0 ? (
                  overnightChanges.escalatedNew.slice(0, 3).map((e) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <RiskPill
                        score={e.risk_score}
                        category={e.risk_category}
                        className="scale-75 origin-left"
                      />
                      <span className="text-[11px] text-sentinel-text-secondary truncate">
                        {e.disease}
                      </span>
                      <span className="text-[10px] text-sentinel-text-muted">
                        {e.countries.join(", ")}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-sentinel-text-muted">
                    No elevated signals
                  </span>
                )}
              </div>
            </div>

            {/* New diseases / countries */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                New This Period
              </div>
              <div className="mt-1 space-y-1">
                {overnightChanges.uniqueNewDiseases.length > 0 && (
                  <div className="text-[11px] text-sentinel-text-secondary">
                    <span className="text-sentinel-text-muted">Diseases: </span>
                    {overnightChanges.uniqueNewDiseases.join(", ")}
                  </div>
                )}
                {overnightChanges.uniqueNewCountries.length > 0 && (
                  <div className="text-[11px] text-sentinel-text-secondary">
                    <span className="text-sentinel-text-muted">Countries: </span>
                    {overnightChanges.uniqueNewCountries.join(", ")}
                  </div>
                )}
                {overnightChanges.uniqueNewDiseases.length === 0 &&
                  overnightChanges.uniqueNewCountries.length === 0 && (
                    <span className="text-[11px] text-sentinel-text-muted">
                      No new diseases or countries
                    </span>
                  )}
              </div>
            </div>

            {/* Active situations */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                Active Situations
              </div>
              <div className="mt-1 space-y-1">
                {overnightChanges.activeSituations.length > 0 ? (
                  overnightChanges.activeSituations.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      href={`/situations/${s.id}`}
                      className="flex items-center gap-1.5 text-[11px] text-sentinel-text-secondary hover:text-sentinel-text"
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.status === "ESCALATED" ? "bg-sentinel-critical" : "bg-sentinel-high"}`} />
                      <span className="truncate">{s.title}</span>
                    </Link>
                  ))
                ) : (
                  <span className="text-[11px] text-sentinel-text-muted">
                    No active situations
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Content: Threat Matrix + Priority Events */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6">
        {/* LEFT: World Risk Overview — Threat Matrix */}
        <Card className="xl:col-span-3 p-0 overflow-hidden">
          <div className="border-b border-sentinel-border px-5 py-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Threat Matrix — Region x Disease
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-sentinel-border-subtle">
                  <th className="sticky left-0 z-10 bg-sentinel-surface px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-sentinel-text-muted">
                    Region
                  </th>
                  {allDiseases.map((disease) => (
                    <th
                      key={disease}
                      className="px-3 py-2.5 text-center font-medium text-sentinel-text-muted"
                      title={disease}
                    >
                      <span className="block max-w-[80px] truncate">
                        {disease.replace("Avian influenza A(H5N1)", "H5N1 AI")
                          .replace("Crimean-Congo haemorrhagic fever", "CCHF")
                          .replace("Undiagnosed respiratory illness", "URI")
                          .replace("Foot-and-mouth disease", "FMD")
                          .replace("African swine fever", "ASF")
                          .replace("Rift Valley fever", "RVF")
                          .replace("Marburg virus disease", "Marburg")
                          .replace("West Nile fever", "WNV")}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider text-sentinel-text-muted">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {threatMatrix.map((row) => (
                  <tr
                    key={row.region}
                    className="border-b border-sentinel-border-subtle last:border-b-0"
                  >
                    <td className="sticky left-0 z-10 bg-sentinel-surface px-4 py-2.5 font-medium text-sentinel-text-secondary">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              REGION_COLORS[row.region] || "#71717a",
                          }}
                        />
                        {row.region}
                      </span>
                    </td>
                    {allDiseases.map((disease) => {
                      const cell = row.diseases.get(disease);
                      if (!cell)
                        return (
                          <td
                            key={disease}
                            className="px-3 py-2.5 text-center text-sentinel-text-muted"
                          >
                            <span className="opacity-20">-</span>
                          </td>
                        );
                      return (
                        <td key={disease} className="px-3 py-2.5 text-center">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded font-mono font-semibold"
                            style={{
                              backgroundColor: riskBg(cell.maxRisk),
                              color: riskColor(cell.maxRisk),
                            }}
                          >
                            {cell.count}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-mono font-semibold text-sentinel-text">
                        {row.totalCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* RIGHT: Priority Events */}
        <Card className="xl:col-span-2 p-0 overflow-hidden">
          <div className="border-b border-sentinel-border px-5 py-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
              Priority Events — Top 10
            </h2>
            <Link
              href="/triage"
              className="text-[10px] font-medium uppercase tracking-wider text-sentinel-text-muted hover:text-sentinel-text-secondary"
            >
              View All
            </Link>
          </div>
          <div className="divide-y divide-sentinel-border-subtle overflow-y-auto max-h-[520px]">
            {priorityEvents.map((evt) => (
              <Link
                key={evt.id}
                href="/triage"
                className="flex items-start gap-3 px-4 py-3 hover:bg-sentinel-surface-hover"
              >
                <RiskPill
                  score={evt.risk_score}
                  category={evt.risk_category}
                  className="shrink-0 mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <SourceBadge source={evt.source} />
                    <span className="text-[10px] text-sentinel-text-muted">
                      {evt.countries.join(", ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] font-medium leading-tight text-sentinel-text line-clamp-1">
                    {evt.disease}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-sentinel-text-secondary line-clamp-1">
                    {evt.summary}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-sentinel-text-muted">
                      CH {evt.swiss_relevance.toFixed(1)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Strip: Disease Trend Sparklines */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-sentinel-border px-5 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
            6-Day Trend by Disease
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          {diseaseTrends.map(([disease, counts]) => {
            const total = counts.reduce((s, v) => s + v, 0);
            return (
              <div
                key={disease}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b lg:border-b-0 lg:border-r border-sentinel-border-subtle last:border-b-0 last:lg:border-r-0"
              >
                <div>
                  <p className="text-[11px] font-medium text-sentinel-text-secondary leading-none">
                    {disease
                      .replace("Avian influenza A(H5N1)", "H5N1 AI")
                      .replace("Crimean-Congo haemorrhagic fever", "CCHF")
                      .replace("Undiagnosed respiratory illness", "URI")
                      .replace("Foot-and-mouth disease", "FMD")
                      .replace("African swine fever", "ASF")
                      .replace("Rift Valley fever", "RVF")
                      .replace("Marburg virus disease", "Marburg")
                      .replace("West Nile fever", "WNV")}
                  </p>
                  <p className="mt-1 text-[10px] font-mono text-sentinel-text-muted">
                    {total} events
                  </p>
                </div>
                <Sparkline
                  data={counts}
                  width={56}
                  height={20}
                  color={
                    total >= 5
                      ? RISK_COLORS.CRITICAL.dot
                      : total >= 3
                        ? RISK_COLORS.HIGH.dot
                        : "#71717a"
                  }
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Data Sources — Transparency */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-sentinel-border px-5 py-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
            Data Sources
          </h2>
          <span className="text-[10px] text-sentinel-text-muted">
            {events.length} total events from {Object.keys(sourceCounts).length} sources
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(SOURCE_LABELS) as Source[]).map((src) => {
            const meta = SOURCE_LABELS[src];
            const stats = sourceCounts[src];
            return (
              <div key={src} className="border-t sm:border-t-0 sm:border-l first:border-t-0 first:sm:border-l-0 border-sentinel-border-subtle px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${stats ? "bg-sentinel-clear" : "bg-sentinel-text-muted opacity-40"}`}
                  />
                  <SourceBadge source={src} />
                </div>
                <p className="text-[10px] text-sentinel-text-muted leading-snug">
                  {meta.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-sentinel-text-secondary">
                    {stats?.total ?? 0} events
                  </span>
                  {stats && (
                    <span className="text-[10px] text-sentinel-text-muted">
                      Last: {stats.latest}
                    </span>
                  )}
                </div>
                <a
                  href={meta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-sentinel-accent hover:underline truncate block"
                >
                  {meta.url.replace("https://", "")}
                </a>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
