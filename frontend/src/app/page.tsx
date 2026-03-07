"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  getManifest,
  loadAllEvents,
  loadCollectorHealth,
  loadIngestionDelta,
  loadSituations,
  type Manifest,
} from "@/lib/api";
import type { CollectorStatus, HealthEvent, IngestionDelta, Situation, Source } from "@/lib/types";
import { RISK_COLORS, SOURCE_LABELS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { KPICard } from "@/components/ui/KPICard";
import { RiskPill } from "@/components/ui/RiskPill";
import { SourceBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";

// DATES derived from loaded events in the component

const WHO_REGION_NAMES: Record<string, string> = {
  // WHO region codes
  EURO: "Europe",
  SEARO: "Southeast Asia",
  AFRO: "Africa",
  AMRO: "Americas",
  EMRO: "Middle East",
  WPRO: "Western Pacific",
  // Sub-region normalization
  "West Africa": "Africa",
  "East Africa": "Africa",
  "Central Africa": "Africa",
  "North Africa": "Africa",
  "Southern Africa": "Africa",
  "Central Asia": "Middle East",
  "South Asia": "Southeast Asia",
  "East Asia": "Western Pacific",
  "South America": "Americas",
  "Central America": "Americas",
  "North America": "Americas",
  "Caribbean": "Americas",
  // Pass-through for already-normalized values
  Europe: "Europe",
  Africa: "Africa",
  "Southeast Asia": "Southeast Asia",
  Americas: "Americas",
  "Middle East": "Middle East",
  "Western Pacific": "Western Pacific",
};

const DISEASE_SHORT: Record<string, string> = {
  "Avian influenza A(H5N1)": "H5N1 AI",
  "Avian influenza A(H5N6)": "H5N6 AI",
  "Avian influenza A(H7N9)": "H7N9 AI",
  "Crimean-Congo haemorrhagic fever": "CCHF",
  "Undiagnosed respiratory illness": "URI",
  "Foot-and-mouth disease": "FMD",
  "African swine fever": "ASF",
  "Rift Valley fever": "RVF",
  "Marburg virus disease": "Marburg",
  "West Nile fever": "WNV",
  "Mpox: recombinant virus with genomic elements of clades Ib and IIb": "Mpox Ib/IIb",
};

function shortenDisease(name: string): string {
  return DISEASE_SHORT[name] || name;
}

const REGION_COLORS: Record<string, string> = {
  Europe: "#3b82f6",
  "Southeast Asia": "#f97316",
  Africa: "#ef4444",
  Americas: "#a855f7",
  "Middle East": "#14b8a6",
  "Western Pacific": "#06b6d4",
};



export default function CommandCenter() {
  const { t } = useI18n();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [collectorStatuses, setCollectorStatuses] = useState<CollectorStatus[]>([]);
  const [ingestionDelta, setIngestionDelta] = useState<IngestionDelta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadAllEvents(),
      loadSituations(),
      getManifest(),
      loadCollectorHealth(),
      loadIngestionDelta(),
    ])
      .then(([evts, sits, manifestData, healthData, deltaData]) => {
        setEvents(evts);
        setSituations(sits);
        setManifest(manifestData);
        setCollectorStatuses(healthData?.statuses || []);
        setIngestionDelta(deltaData);
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

  // Disease-centric threat landscape
  const diseaseThreats = useMemo(() => {
    const map = new Map<
      string,
      {
        disease: string;
        events: HealthEvent[];
        maxRisk: number;
        maxSwissRelevance: number;
        totalCases: number;
        totalDeaths: number;
        countries: Set<string>;
        regions: Set<string>;
        sources: Set<string>;
        ihrFlags: number; // count of true IHR criteria
        hasConfirmed: boolean;
        trend: number[]; // daily counts for sparkline
      }
    >();

    for (const evt of events) {
      if (!map.has(evt.disease)) {
        map.set(evt.disease, {
          disease: evt.disease,
          events: [],
          maxRisk: 0,
          maxSwissRelevance: 0,
          totalCases: 0,
          totalDeaths: 0,
          countries: new Set(),
          regions: new Set(),
          sources: new Set(),
          ihrFlags: 0,
          hasConfirmed: false,
          trend: [],
        });
      }
      const d = map.get(evt.disease)!;
      d.events.push(evt);
      d.maxRisk = Math.max(d.maxRisk, evt.risk_score);
      d.maxSwissRelevance = Math.max(d.maxSwissRelevance, evt.swiss_relevance);
      if (evt.case_count) d.totalCases += evt.case_count;
      if (evt.death_count) d.totalDeaths += evt.death_count;
      evt.countries.forEach((c) => d.countries.add(c));
      evt.regions.forEach((r) => d.regions.add(WHO_REGION_NAMES[r] || r));
      d.sources.add(evt.source);
      if (evt.verification_status === "CONFIRMED") d.hasConfirmed = true;
      const flags = [evt.ihr_unusual, evt.ihr_serious_impact, evt.ihr_international_spread, evt.ihr_trade_travel_risk];
      d.ihrFlags = Math.max(d.ihrFlags, flags.filter(Boolean).length);
    }

    // Compute trends
    for (const d of map.values()) {
      d.trend = DATES.map(
        (dt) => d.events.filter((e) => e.date_reported === dt).length,
      );
    }

    return Array.from(map.values()).sort((a, b) => {
      // Sort by max risk descending, then by swiss relevance, then by event count
      if (b.maxRisk !== a.maxRisk) return b.maxRisk - a.maxRisk;
      if (b.maxSwissRelevance !== a.maxSwissRelevance) return b.maxSwissRelevance - a.maxSwissRelevance;
      return b.events.length - a.events.length;
    });
  }, [events, DATES]);

  // Source statistics for transparency panel
  const sourceCounts = useMemo(() => {
    const counts: Record<string, { total: number; latest: string }> = {};
    const projected = manifest?.projected_source_totals || {};
    for (const [source, total] of Object.entries(projected)) {
      counts[source] = {
        total,
        latest: manifest?.latest_collection || "",
      };
    }
    if (Object.keys(counts).length === 0) {
      for (const evt of events) {
        if (!counts[evt.source]) {
          counts[evt.source] = { total: 0, latest: "" };
        }
        counts[evt.source].total++;
        if (evt.date_collected > (counts[evt.source].latest || "")) {
          counts[evt.source].latest = evt.date_collected;
        }
      }
    }
    return counts;
  }, [events, manifest]);

  const ingestionNewCount = ingestionDelta?.new_count ?? todayEvents.length;
  const ingestionChangedCount = ingestionDelta?.changed_count ?? 0;
  const ingestionRetiredCount = ingestionDelta?.retired_count ?? 0;

  const pipelineSummary = useMemo(() => {
    if (collectorStatuses.length === 0) {
      return {
        dotClass: "bg-sentinel-text-muted",
        label: "Pipeline status unavailable",
      };
    }
    const failed = collectorStatuses.filter((s) => !s.ok);
    if (failed.length === 0) {
      return {
        dotClass: "bg-sentinel-clear",
        label: `Pipeline healthy • ${collectorStatuses.length} sources OK`,
      };
    }
    return {
      dotClass: failed.length === collectorStatuses.length ? "bg-sentinel-critical" : "bg-sentinel-high",
      label: `${failed.length}/${collectorStatuses.length} source collectors failed`,
    };
  }, [collectorStatuses]);

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
            {t("loading.intelligence")}
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
            {t("nav.commandCenter")}
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            {t("cc.subtitle")} — {latestDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${pipelineSummary.dotClass}`} />
          <span className="text-[10px] text-sentinel-text-muted">
            {pipelineSummary.label}
          </span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          label={t("cc.newEvents24h")}
          value={ingestionNewCount}
          delta={ingestionDelta
            ? ingestionChangedCount
            : todayEvents.length -
              events.filter((e) => e.date_reported === previousDate).length}
          sparkData={dailyCounts}
        />
        <KPICard
          label={t("cc.activeSituations")}
          value={situations.length}
          sparkData={dailyCounts.map(() => situations.length)}
        />
        <KPICard
          label={t("cc.criticalAlerts")}
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
          label={t("cc.swissRelevant")}
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
              {t("cc.whatChanged")} — {ingestionDelta?.latest_collection || latestDate}
            </h2>
            <span className="text-[10px] text-sentinel-text-muted">
              {t("cc.vs")} {ingestionDelta?.previous_collection || previousDate || "—"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-sentinel-border-subtle">
            {/* New events */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                {t("cc.newEvents")}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-mono font-bold tabular-nums text-sentinel-text">
                  {ingestionNewCount}
                </span>
                {(ingestionChangedCount > 0 || ingestionRetiredCount > 0) && (
                  <span className="text-[10px] text-sentinel-text-muted">
                    (changed: {ingestionChangedCount}, retired: {ingestionRetiredCount})
                  </span>
                )}
              </div>
            </div>

            {/* Elevated signals */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                {t("cc.elevatedSignals")}
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
                    {t("cc.noElevated")}
                  </span>
                )}
              </div>
            </div>

            {/* New diseases / countries */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                {t("cc.newThisPeriod")}
              </div>
              <div className="mt-1 space-y-1">
                {overnightChanges.uniqueNewDiseases.length > 0 && (
                  <div className="text-[11px] text-sentinel-text-secondary">
                    <span className="text-sentinel-text-muted">{t("cc.diseases")}: </span>
                    {overnightChanges.uniqueNewDiseases.join(", ")}
                  </div>
                )}
                {overnightChanges.uniqueNewCountries.length > 0 && (
                  <div className="text-[11px] text-sentinel-text-secondary">
                    <span className="text-sentinel-text-muted">{t("cc.countries")}: </span>
                    {overnightChanges.uniqueNewCountries.join(", ")}
                  </div>
                )}
                {overnightChanges.uniqueNewDiseases.length === 0 &&
                  overnightChanges.uniqueNewCountries.length === 0 && (
                    <span className="text-[11px] text-sentinel-text-muted">
                      {t("cc.noNewDiseaseCountry")}
                    </span>
                  )}
              </div>
            </div>

            {/* Active situations */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                {t("cc.activeSituations")}
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
                    {t("cc.noActiveSituations")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Active Threat Landscape */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-sentinel-border px-5 py-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
            {t("cc.activeThreats")}
          </h2>
          <Link
            href="/triage"
            className="text-[10px] font-medium uppercase tracking-wider text-sentinel-text-muted hover:text-sentinel-text-secondary"
          >
            {t("cc.fullTriage")}
          </Link>
        </div>
        <div className="divide-y divide-sentinel-border-subtle">
          {diseaseThreats.map((threat) => {
            const trendUp =
              threat.trend.length >= 2 &&
              threat.trend[threat.trend.length - 1] >
                threat.trend[threat.trend.length - 2];
            const trendDown =
              threat.trend.length >= 2 &&
              threat.trend[threat.trend.length - 1] <
                threat.trend[threat.trend.length - 2];
            const riskCat =
              threat.maxRisk >= 8
                ? "CRITICAL"
                : threat.maxRisk >= 6
                  ? "HIGH"
                  : threat.maxRisk >= 4
                    ? "MEDIUM"
                    : "LOW";

            return (
              <div
                key={threat.disease}
                className="px-4 sm:px-5 py-3 hover:bg-sentinel-surface-hover"
              >
                {/* Row 1: Risk + Disease name + Trend */}
                <div className="flex items-center gap-3">
                  {/* Risk bar */}
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: riskColor(threat.maxRisk) }}
                  />

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className="text-[13px] font-semibold text-sentinel-text"
                        title={threat.disease}
                      >
                        {shortenDisease(threat.disease)}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: riskBg(threat.maxRisk),
                          color: riskColor(threat.maxRisk),
                        }}
                      >
                        {threat.maxRisk.toFixed(1)} {riskCat}
                      </span>
                      {threat.maxSwissRelevance >= 4.0 && (
                        <span className="text-[10px] font-mono font-semibold text-sentinel-high tabular-nums">
                          CH {threat.maxSwissRelevance.toFixed(1)}
                        </span>
                      )}
                      {threat.hasConfirmed && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5">
                          {t("metric.confirmed")}
                        </span>
                      )}
                      {threat.ihrFlags >= 3 && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-sentinel-critical bg-sentinel-critical-bg rounded px-1.5 py-0.5">
                          IHR {threat.ihrFlags}/4
                        </span>
                      )}
                    </div>

                    {/* Row 2: Metrics */}
                    <div className="mt-1.5 flex items-center gap-4 flex-wrap text-[11px]">
                      {/* Events count */}
                      <span className="text-sentinel-text-secondary">
                        <span className="font-mono font-semibold tabular-nums text-sentinel-text">
                          {threat.events.length}
                        </span>{" "}
                        {t("metric.events")}
                      </span>

                      {/* Cases / deaths */}
                      {(threat.totalCases > 0 || threat.totalDeaths > 0) && (
                        <span className="text-sentinel-text-muted">
                          {threat.totalCases > 0 && (
                            <span>
                              <span className="font-mono tabular-nums">{threat.totalCases.toLocaleString()}</span> {t("metric.cases")}
                            </span>
                          )}
                          {threat.totalCases > 0 && threat.totalDeaths > 0 && " · "}
                          {threat.totalDeaths > 0 && (
                            <span className="text-sentinel-critical">
                              <span className="font-mono tabular-nums">{threat.totalDeaths.toLocaleString()}</span> {t("metric.deaths")}
                            </span>
                          )}
                        </span>
                      )}

                      {/* Geographic spread */}
                      <span className="text-sentinel-text-muted">
                        {Array.from(threat.regions).map((region) => (
                          <span
                            key={region}
                            className="inline-flex items-center gap-1 mr-2"
                          >
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  REGION_COLORS[region] || "#71717a",
                              }}
                            />
                            <span className="text-[10px]">{region}</span>
                          </span>
                        ))}
                      </span>

                      {/* Countries */}
                      <span className="text-[10px] font-mono text-sentinel-text-muted">
                        {Array.from(threat.countries).slice(0, 6).join(", ")}
                        {threat.countries.size > 6 && ` +${threat.countries.size - 6}`}
                      </span>
                    </div>
                  </div>

                  {/* Right: trend sparkline + direction */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Sparkline
                      data={threat.trend}
                      width={64}
                      height={24}
                      color={riskColor(threat.maxRisk)}
                    />
                    <span className="text-[14px] w-4 text-center">
                      {trendUp ? (
                        <span className="text-sentinel-critical">↑</span>
                      ) : trendDown ? (
                        <span className="text-sentinel-clear">↓</span>
                      ) : (
                        <span className="text-sentinel-text-muted">→</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Data Sources — Transparency */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-sentinel-border px-5 py-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
            {t("cc.dataSources")}
          </h2>
          <span className="text-[10px] text-sentinel-text-muted">
            {(manifest?.total_events ?? events.length)} {t("cc.totalEventsFrom")} {Object.keys(sourceCounts).length} {t("cc.sources")}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(SOURCE_LABELS) as Source[]).map((src) => {
            const meta = SOURCE_LABELS[src];
            const stats = sourceCounts[src];
            const health = collectorStatuses.find((status) => status.source === src);
            const indicatorClass = health ? (health.ok ? "bg-sentinel-clear" : "bg-sentinel-critical") : stats ? "bg-sentinel-high" : "bg-sentinel-text-muted opacity-40";
            return (
              <div key={src} className="border-t sm:border-t-0 sm:border-l first:border-t-0 first:sm:border-l-0 border-sentinel-border-subtle px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${indicatorClass}`}
                  />
                  <SourceBadge source={src} />
                </div>
                <p className="text-[10px] text-sentinel-text-muted leading-snug">
                  {meta.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-sentinel-text-secondary">
                    {stats?.total ?? 0} {t("metric.events")}
                  </span>
                  {stats && (
                    <span className="text-[10px] text-sentinel-text-muted">
                      {t("cc.last")}: {stats.latest}
                    </span>
                  )}
                </div>
                {health && (
                  <div className="text-[10px] text-sentinel-text-muted">
                    {health.ok
                      ? `Latency ${health.latency_seconds.toFixed(1)}s`
                      : `Collector error: ${health.error || "unknown"}`}
                  </div>
                )}
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
