"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { geoNaturalEarth1, geoPath, geoGraticule } from "d3-geo";
import * as topojson from "topojson-client";
import { topology } from "@/data/world-110m";
import {
  NUMERIC_TO_ALPHA2,
  COUNTRY_CENTROIDS,
  SWISS_NEIGHBORS,
} from "@/data/country-centroids";
import { RISK_COLORS, COUNTRY_NAMES } from "@/lib/constants";
import type { HealthEvent, RiskCategory } from "@/lib/types";
import { RiskPill } from "@/components/ui/RiskPill";
import { Badge } from "@/components/ui/Badge";
import { MapLegend } from "./MapLegend";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Filter,
  X,
  ExternalLink,
  TrendingUp,
  Users,
  Skull,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/* ---------- Helpers ---------- */

function getMaxRisk(events: HealthEvent[]): RiskCategory {
  if (events.some((e) => e.risk_category === "CRITICAL")) return "CRITICAL";
  if (events.some((e) => e.risk_category === "HIGH")) return "HIGH";
  if (events.some((e) => e.risk_category === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

const RISK_ORDER: Record<RiskCategory, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const RISK_LEVELS: RiskCategory[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/* ---------- Types ---------- */

interface GlobalMapProps {
  events: HealthEvent[];
  selectedDate: string;
  availableDates?: string[];
  onDateChange: (date: string) => void;
}

interface TooltipState {
  x: number;
  y: number;
  country: string;
  events: HealthEvent[];
}

/* ---------- Component ---------- */

export function GlobalMap({
  events,
  selectedDate,
  availableDates,
  onDateChange,
}: GlobalMapProps) {
  const { t } = useI18n();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [activeRiskFilters, setActiveRiskFilters] = useState<Set<RiskCategory>>(
    new Set(RISK_LEVELS),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive available dates from events
  const inferredDates = useMemo(() => {
    const dateSet = new Set(events.map((e) => e.date_reported));
    return [...dateSet].sort();
  }, [events]);
  const DATES =
    availableDates && availableDates.length > 0 ? availableDates : inferredDates;

  const currentDateIndex = DATES.indexOf(selectedDate);

  // --- Filter events by active risk levels ---
  const filteredEvents = useMemo(
    () => events.filter((e) => activeRiskFilters.has(e.risk_category)),
    [events, activeRiskFilters],
  );

  // --- Zoom / Pan state ---
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const isPanning = useRef(false);
  const panStart = useRef<[number, number]>([0, 0]);
  const panOffset = useRef<[number, number]>([0, 0]);

  // --- Auto-play timeline ---
  useEffect(() => {
    if (isPlaying && DATES.length > 1) {
      playIntervalRef.current = setInterval(() => {
        onDateChange(
          DATES[
            ((DATES.indexOf(selectedDate) + 1) % DATES.length)
          ],
        );
      }, 1500);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, selectedDate, DATES, onDateChange]);

  // --- Projection & Path Generator ---
  const { projection, pathGenerator, graticule } = useMemo(() => {
    const proj = geoNaturalEarth1()
      .center([8.2, 46.8])
      .scale(280)
      .translate([480, 260]);
    const path = geoPath(proj);
    const grat = geoGraticule().step([30, 30]);
    return { projection: proj, pathGenerator: path, graticule: grat };
  }, []);

  // --- GeoJSON features from TopoJSON ---
  const countries = useMemo(() => {
    const topoCountries = topology.objects.countries;
    if (!topoCountries) return [];
    const featureCollection = topojson.feature(topology, topoCountries);
    if (featureCollection.type === "FeatureCollection") {
      return featureCollection.features;
    }
    return [];
  }, []);

  // --- Build ID -> alpha2 lookup ---
  const idToAlpha2 = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [numericId, alpha2] of Object.entries(NUMERIC_TO_ALPHA2)) {
      map[numericId] = alpha2;
    }
    return map;
  }, []);

  // --- Group filtered events by country ---
  const countryEvents = useMemo(() => {
    const map: Record<string, HealthEvent[]> = {};
    for (const evt of filteredEvents) {
      for (const cc of evt.countries) {
        if (!map[cc]) map[cc] = [];
        map[cc].push(evt);
      }
    }
    return map;
  }, [filteredEvents]);

  const activeCountries = useMemo(
    () => new Set(Object.keys(countryEvents)),
    [countryEvents],
  );

  // --- Max event count for graduated fills ---
  const maxCountryEventCount = useMemo(
    () =>
      Math.max(
        1,
        ...Object.values(countryEvents).map((evts) => evts.length),
      ),
    [countryEvents],
  );

  // --- Selected country events ---
  const detailEvents = selectedCountry
    ? countryEvents[selectedCountry] || []
    : [];

  // --- Disease summary for selected country ---
  const diseaseSummary = useMemo(() => {
    const map: Record<string, { count: number; cases: number; deaths: number; maxRisk: RiskCategory }> = {};
    for (const evt of detailEvents) {
      if (!map[evt.disease]) {
        map[evt.disease] = { count: 0, cases: 0, deaths: 0, maxRisk: "LOW" };
      }
      map[evt.disease].count++;
      map[evt.disease].cases += evt.case_count || 0;
      map[evt.disease].deaths += evt.death_count || 0;
      if (RISK_ORDER[evt.risk_category] > RISK_ORDER[map[evt.disease].maxRisk]) {
        map[evt.disease].maxRisk = evt.risk_category;
      }
    }
    return Object.entries(map).sort(
      (a, b) => RISK_ORDER[b[1].maxRisk] - RISK_ORDER[a[1].maxRisk] || b[1].count - a[1].count,
    );
  }, [detailEvents]);

  // --- Projected centroids ---
  const projectedCentroids = useMemo(() => {
    const result: Record<string, [number, number]> = {};
    for (const [cc, [lon, lat]] of Object.entries(COUNTRY_CENTROIDS)) {
      const p = projection([lon, lat]);
      if (p) result[cc] = p as [number, number];
    }
    return result;
  }, [projection]);

  // --- Switzerland projected position ---
  const chPos = projectedCentroids["CH"];

  // --- Threat arc data ---
  const threatArcs = useMemo(() => {
    const arcs: {
      from: string;
      fromPos: [number, number];
      toPos: [number, number];
      risk: RiskCategory;
      count: number;
      dur: number;
    }[] = [];

    if (!chPos) return arcs;

    let seed = 0;
    for (const cc of Object.keys(countryEvents)) {
      if (cc === "CH") continue;
      const evts = countryEvents[cc];
      const maxRisk = getMaxRisk(evts);
      const isNeighbor = SWISS_NEIGHBORS.includes(cc);
      if (!isNeighbor && RISK_ORDER[maxRisk] < RISK_ORDER["HIGH"]) continue;
      const fromPos = projectedCentroids[cc];
      if (!fromPos) continue;
      seed += 1;
      const dur = 3 + (seed % 5) * 0.4;
      arcs.push({ from: cc, fromPos, toPos: chPos, risk: maxRisk, count: evts.length, dur });
    }

    return arcs.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  }, [countryEvents, projectedCentroids, chPos]);

  // --- Arc path generator (quadratic bezier) ---
  const getArcPath = useCallback(
    (from: [number, number], to: [number, number]) => {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      const mx = (from[0] + to[0]) / 2;
      const my = (from[1] + to[1]) / 2;
      const curvature = Math.min(dist * 0.3, 80);
      const nx = -dy / dist;
      const ny = dx / dist;
      const cx = mx + nx * curvature;
      const cy = my + ny * curvature;
      return `M${from[0]},${from[1]} Q${cx},${cy} ${to[0]},${to[1]}`;
    },
    [],
  );

  // --- Graticule paths ---
  const graticulePath = useMemo(
    () => pathGenerator(graticule()) || "",
    [pathGenerator, graticule],
  );

  const equatorPath = useMemo(() => {
    const equator: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 361 }, (_, i) => [i - 180, 0]),
      },
    };
    return pathGenerator(equator) || "";
  }, [pathGenerator]);

  const spherePath = useMemo(
    () => pathGenerator({ type: "Sphere" }) || "",
    [pathGenerator],
  );

  // --- Mouse handlers ---
  const handleCountryHover = useCallback(
    (e: React.MouseEvent, cc: string) => {
      if (!activeCountries.has(cc)) return;
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 10,
        country: cc,
        events: countryEvents[cc] || [],
      });
    },
    [activeCountries, countryEvents],
  );

  const handleCountryLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleCountryClick = useCallback(
    (cc: string) => {
      if (!activeCountries.has(cc)) return;
      setSelectedCountry(cc === selectedCountry ? null : cc);
      setSidebarCollapsed(false);
    },
    [activeCountries, selectedCountry],
  );

  // --- Zoom handlers ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => Math.min(Math.max(z + delta, 0.5), 8));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      isPanning.current = true;
      panStart.current = [e.clientX, e.clientY];
      panOffset.current = pan;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [pan],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current[0];
    const dy = e.clientY - panStart.current[1];
    setPan([panOffset.current[0] + dx, panOffset.current[1] + dy]);
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan([0, 0]);
  }, []);

  // --- Risk filter toggle ---
  const toggleRiskFilter = useCallback((level: RiskCategory) => {
    setActiveRiskFilters((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size > 1) next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  // --- Container measurement ---
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {});
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stats
  const criticalCount = filteredEvents.filter(
    (e) => e.risk_category === "CRITICAL",
  ).length;
  const highCount = filteredEvents.filter(
    (e) => e.risk_category === "HIGH",
  ).length;
  const totalCases = filteredEvents.reduce(
    (sum, e) => sum + (e.case_count || 0),
    0,
  );
  const totalDeaths = filteredEvents.reduce(
    (sum, e) => sum + (e.death_count || 0),
    0,
  );

  // --- Tooltip disease grouping ---
  const tooltipDiseases = useMemo(() => {
    if (!tooltip) return [];
    const map: Record<string, { count: number; risk: RiskCategory }> = {};
    for (const evt of tooltip.events) {
      if (!map[evt.disease]) map[evt.disease] = { count: 0, risk: "LOW" };
      map[evt.disease].count++;
      if (RISK_ORDER[evt.risk_category] > RISK_ORDER[map[evt.disease].risk]) {
        map[evt.disease].risk = evt.risk_category;
      }
    }
    return Object.entries(map)
      .sort((a, b) => RISK_ORDER[b[1].risk] - RISK_ORDER[a[1].risk])
      .slice(0, 4);
  }, [tooltip]);

  return (
    <div className="flex h-full flex-col">
      {/* Map area */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* SVG Map */}
        <div className="flex flex-1 flex-col min-h-0">
          <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden bg-sentinel-bg"
          >
            <svg
              ref={svgRef}
              viewBox="0 0 960 520"
              className="h-full w-full select-none"
              preserveAspectRatio="xMidYMid meet"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ cursor: "grab" }}
            >
              <defs>
                <filter id="glow-ch" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="glow-critical" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="ch-glow-gradient">
                  <stop offset="0%" stopColor="var(--sentinel-accent)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--sentinel-accent)" stopOpacity="0" />
                </radialGradient>
                {threatArcs.map((arc) => (
                  <linearGradient
                    key={`grad-${arc.from}`}
                    id={`arc-grad-${arc.from}`}
                    x1={arc.fromPos[0]}
                    y1={arc.fromPos[1]}
                    x2={arc.toPos[0]}
                    y2={arc.toPos[1]}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={RISK_COLORS[arc.risk].dot} stopOpacity="0.6" />
                    <stop offset="100%" stopColor={RISK_COLORS[arc.risk].dot} stopOpacity="0.15" />
                  </linearGradient>
                ))}
              </defs>

              <g
                transform={`translate(${480 + pan[0]}, ${260 + pan[1]}) scale(${zoom}) translate(-480, -260)`}
              >
                {/* Background sphere */}
                <path
                  d={spherePath}
                  fill="var(--sentinel-map-water)"
                  stroke="var(--sentinel-map-border)"
                  strokeWidth={0.5}
                />

                {/* Graticule */}
                <path
                  d={graticulePath}
                  fill="none"
                  stroke="var(--sentinel-map-graticule)"
                  strokeWidth={0.3}
                  strokeOpacity={0.6}
                />

                {/* Equator */}
                <path
                  d={equatorPath}
                  fill="none"
                  stroke="var(--sentinel-border)"
                  strokeWidth={0.6}
                  strokeDasharray="4 3"
                />

                {/* Country paths — graduated fills */}
                {countries.map((feature) => {
                  const id = String(feature.id);
                  const alpha2 = idToAlpha2[id];
                  const d = pathGenerator(feature);
                  if (!d) return null;

                  const hasEvents = alpha2 ? activeCountries.has(alpha2) : false;
                  const evts = alpha2 ? countryEvents[alpha2] || [] : [];
                  const maxRisk = hasEvents ? getMaxRisk(evts) : null;
                  const color = maxRisk ? RISK_COLORS[maxRisk].dot : null;
                  const isSelected = selectedCountry === alpha2;
                  const isCH = alpha2 === "CH";

                  // Graduated opacity: more events = more opaque fill
                  const intensity = hasEvents
                    ? 0.08 + 0.22 * Math.min(evts.length / maxCountryEventCount, 1)
                    : 0;
                  const fillOpacity = Math.round(intensity * 255)
                    .toString(16)
                    .padStart(2, "0");

                  return (
                    <path
                      key={id}
                      d={d}
                      fill={
                        isCH
                          ? hasEvents && color
                            ? `${color}${fillOpacity}`
                            : "var(--sentinel-surface-hover)"
                          : hasEvents && color
                            ? `${color}${fillOpacity}`
                            : "var(--sentinel-map-land)"
                      }
                      stroke={
                        isSelected
                          ? "var(--sentinel-text)"
                          : isCH
                            ? "var(--sentinel-text-muted)"
                            : hasEvents && color
                              ? `${color}60`
                              : "var(--sentinel-map-border)"
                      }
                      strokeWidth={
                        isSelected ? 1.5 : isCH ? 1.2 : hasEvents ? 0.6 : 0.3
                      }
                      className={clsx(
                        "transition-[fill,stroke] duration-300",
                        hasEvents && "cursor-pointer",
                        !hasEvents && !isCH && "opacity-50",
                      )}
                      onMouseMove={
                        alpha2
                          ? (e) => handleCountryHover(e, alpha2)
                          : undefined
                      }
                      onMouseLeave={handleCountryLeave}
                      onClick={
                        alpha2 ? () => handleCountryClick(alpha2) : undefined
                      }
                    />
                  );
                })}

                {/* Switzerland highlight glow */}
                {chPos && (
                  <g>
                    <circle
                      cx={chPos[0]}
                      cy={chPos[1]}
                      r={40}
                      fill="url(#ch-glow-gradient)"
                      className="pointer-events-none"
                    />
                    {animationsEnabled && (
                      <>
                        <circle
                          cx={chPos[0]}
                          cy={chPos[1]}
                          r={14}
                          fill="none"
                          stroke="var(--sentinel-accent)"
                          strokeWidth={1}
                          opacity={0.4}
                          className="pointer-events-none animate-pulse-ring"
                        />
                        <circle
                          cx={chPos[0]}
                          cy={chPos[1]}
                          r={14}
                          fill="none"
                          stroke="var(--sentinel-accent)"
                          strokeWidth={0.5}
                          opacity={0.2}
                          className="pointer-events-none animate-pulse-ring-slow"
                        />
                      </>
                    )}
                    <circle
                      cx={chPos[0]}
                      cy={chPos[1]}
                      r={8}
                      fill="none"
                      stroke="var(--sentinel-accent)"
                      strokeWidth={0.8}
                      strokeDasharray="2 2"
                      opacity={0.5}
                      className="pointer-events-none"
                    />
                  </g>
                )}

                {/* Threat arcs with multiple particles */}
                {animationsEnabled &&
                  threatArcs.map((arc) => {
                    const d = getArcPath(arc.fromPos, arc.toPos);
                    const thickness = Math.min(1 + arc.count * 0.5, 3);
                    const particleCount = Math.min(1 + Math.floor(arc.count / 2), 3);
                    return (
                      <g key={`arc-${arc.from}`} className="pointer-events-none">
                        <path
                          d={d}
                          fill="none"
                          stroke={`url(#arc-grad-${arc.from})`}
                          strokeWidth={thickness}
                          strokeDasharray="6 4"
                          className="animate-threat-arc"
                        />
                        {Array.from({ length: particleCount }).map((_, i) => (
                          <circle
                            key={i}
                            r={1.5 + (arc.risk === "CRITICAL" ? 1 : 0)}
                            fill={RISK_COLORS[arc.risk].dot}
                            opacity={0.9}
                          >
                            <animateMotion
                              dur={`${arc.dur}s`}
                              repeatCount="indefinite"
                              path={d}
                              begin={`${(i * arc.dur) / particleCount}s`}
                            />
                          </circle>
                        ))}
                      </g>
                    );
                  })}

                {/* Event markers at country centroids */}
                {Object.entries(countryEvents).map(([cc, evts]) => {
                  const pos = projectedCentroids[cc];
                  if (!pos) return null;
                  const maxRisk = getMaxRisk(evts);
                  const color = RISK_COLORS[maxRisk].dot;
                  const radius = Math.min(4 + evts.length * 1.5, 14);
                  const isCritical = maxRisk === "CRITICAL";

                  return (
                    <g
                      key={`marker-${cc}`}
                      className="pointer-events-none"
                      filter={isCritical ? "url(#glow-critical)" : undefined}
                    >
                      {animationsEnabled && (
                        <circle
                          cx={pos[0]}
                          cy={pos[1]}
                          r={radius}
                          fill="none"
                          stroke={color}
                          strokeWidth={1}
                          opacity={0.4}
                          className="animate-pulse-ring"
                        />
                      )}
                      <circle
                        cx={pos[0]}
                        cy={pos[1]}
                        r={radius * 0.6}
                        fill={color}
                        opacity={0.85}
                      />
                      <circle
                        cx={pos[0]}
                        cy={pos[1]}
                        r={radius * 0.25}
                        fill="#fff"
                        opacity={0.6}
                      />
                      {evts.length > 1 && (
                        <text
                          x={pos[0]}
                          y={pos[1] - radius - 4}
                          textAnchor="middle"
                          className="fill-sentinel-text font-mono"
                          style={{ fontSize: "7px", fontWeight: 600 }}
                        >
                          {evts.length}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Country labels for active countries */}
                {Object.keys(countryEvents).map((cc) => {
                  const pos = projectedCentroids[cc];
                  if (!pos) return null;
                  const evts = countryEvents[cc];
                  const radius = Math.min(4 + evts.length * 1.5, 14);
                  return (
                    <text
                      key={`label-${cc}`}
                      x={pos[0]}
                      y={pos[1] + radius + 9}
                      textAnchor="middle"
                      className="pointer-events-none fill-sentinel-text-secondary font-mono"
                      style={{
                        fontSize: cc === "CH" ? "8px" : "6.5px",
                        fontWeight: cc === "CH" ? 700 : 500,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {cc}
                    </text>
                  );
                })}
              </g>
            </svg>

            {/* Enhanced tooltip */}
            {tooltip && (
              <div
                className="map-tooltip"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div className="flex items-center gap-2 border-b border-sentinel-border-subtle pb-1.5 mb-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        RISK_COLORS[getMaxRisk(tooltip.events)].dot,
                    }}
                  />
                  <span className="font-semibold text-[12px]">
                    {COUNTRY_NAMES[tooltip.country] || tooltip.country}
                  </span>
                  <span className="text-sentinel-text-muted text-[10px]">
                    {tooltip.events.length} event
                    {tooltip.events.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {tooltipDiseases.map(([disease, info]) => (
                  <div
                    key={disease}
                    className="flex items-center gap-2 py-0.5 text-[10px]"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: RISK_COLORS[info.risk].dot }}
                    />
                    <span className="text-sentinel-text-secondary truncate max-w-[140px]">
                      {disease}
                    </span>
                    <span className="text-sentinel-text-muted ml-auto tabular-nums">
                      {info.count}x
                    </span>
                  </div>
                ))}
                {tooltip.events.length > 4 && (
                  <div className="text-[9px] text-sentinel-text-muted mt-1">
                    +{tooltip.events.length - 4} more
                  </div>
                )}
              </div>
            )}

            {/* Zoom controls */}
            <div className="absolute right-4 top-4 flex flex-col gap-1">
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.3, 8))}
                className="flex h-7 w-7 items-center justify-center rounded border border-sentinel-border bg-sentinel-surface/90 text-[14px] font-medium text-sentinel-text-secondary backdrop-blur-sm hover:bg-sentinel-surface-hover hover:text-sentinel-text"
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.3, 0.5))}
                className="flex h-7 w-7 items-center justify-center rounded border border-sentinel-border bg-sentinel-surface/90 text-[14px] font-medium text-sentinel-text-secondary backdrop-blur-sm hover:bg-sentinel-surface-hover hover:text-sentinel-text"
                title="Zoom out"
              >
                −
              </button>
              {(zoom !== 1 || pan[0] !== 0 || pan[1] !== 0) && (
                <button
                  onClick={resetView}
                  className="flex h-7 w-7 items-center justify-center rounded border border-sentinel-border bg-sentinel-surface/90 font-mono text-[9px] font-medium text-sentinel-text-muted backdrop-blur-sm hover:bg-sentinel-surface-hover hover:text-sentinel-text"
                  title="Reset view"
                >
                  1:1
                </button>
              )}
            </div>

            {/* Top-left stats overlay */}
            <div className="absolute left-3 sm:left-4 top-14 md:top-4 flex flex-col gap-2">
              <div className="rounded border border-sentinel-border bg-sentinel-surface/90 px-3 py-2 backdrop-blur-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-text-muted">
                  {t("map.title")}
                </div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-sentinel-text">
                  {filteredEvents.length}
                </div>
                <div className="flex gap-3 mt-1 text-[9px] tabular-nums text-sentinel-text-muted">
                  {totalCases > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-2.5 w-2.5" />
                      {totalCases.toLocaleString()}
                    </span>
                  )}
                  {totalDeaths > 0 && (
                    <span className="flex items-center gap-1 text-sentinel-critical">
                      <Skull className="h-2.5 w-2.5" />
                      {totalDeaths.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded border border-sentinel-border bg-sentinel-surface/90 px-3 py-2 backdrop-blur-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-text-muted">
                  Countries
                </div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-sentinel-text">
                  {activeCountries.size}
                </div>
              </div>
              {criticalCount > 0 && (
                <div className="rounded border border-sentinel-critical/30 bg-sentinel-critical-bg/90 px-3 py-2 backdrop-blur-sm">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-critical">
                    Critical
                  </div>
                  <div className="mt-0.5 text-xl font-semibold tabular-nums text-sentinel-critical">
                    {criticalCount}
                  </div>
                </div>
              )}
              {highCount > 0 && (
                <div className="rounded border border-sentinel-high/30 bg-sentinel-high-bg/90 px-3 py-2 backdrop-blur-sm">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-high">
                    High
                  </div>
                  <div className="mt-0.5 text-xl font-semibold tabular-nums text-sentinel-high">
                    {highCount}
                  </div>
                </div>
              )}
            </div>

            {/* Risk filter overlay */}
            <div className="absolute right-4 bottom-4 md:bottom-auto md:top-[140px]">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  "flex h-7 w-7 items-center justify-center rounded border backdrop-blur-sm transition-colors",
                  showFilters
                    ? "border-sentinel-text/30 bg-sentinel-surface text-sentinel-text"
                    : "border-sentinel-border bg-sentinel-surface/90 text-sentinel-text-muted hover:text-sentinel-text hover:bg-sentinel-surface-hover",
                )}
                title="Filter by risk level"
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
              {showFilters && (
                <div className="mt-1 rounded border border-sentinel-border bg-sentinel-surface/95 backdrop-blur-sm p-2 space-y-1 min-w-[120px]">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-text-muted px-1 pb-1">
                    Risk Filter
                  </div>
                  {RISK_LEVELS.map((level) => {
                    const active = activeRiskFilters.has(level);
                    const count = events.filter(
                      (e) => e.risk_category === level,
                    ).length;
                    return (
                      <button
                        key={level}
                        onClick={() => toggleRiskFilter(level)}
                        className={clsx(
                          "flex w-full items-center gap-2 rounded px-2 py-1 text-[10px] transition-colors",
                          active
                            ? "text-sentinel-text"
                            : "text-sentinel-text-muted opacity-40",
                        )}
                      >
                        <span
                          className={clsx(
                            "h-2 w-2 rounded-full transition-opacity",
                            !active && "opacity-30",
                          )}
                          style={{ backgroundColor: RISK_COLORS[level].dot }}
                        />
                        <span className="flex-1 text-left">{level}</span>
                        <span className="tabular-nums font-mono text-[9px]">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom bar: legend + timeline scrubber + controls */}
          <div className="border-t border-sentinel-border bg-sentinel-surface">
            {/* Timeline scrubber */}
            {DATES.length > 1 && (
              <div className="flex items-center gap-2 px-3 sm:px-4 pt-2 pb-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const idx = Math.max(0, currentDateIndex - 1);
                      onDateChange(DATES[idx]);
                    }}
                    disabled={currentDateIndex <= 0}
                    className="flex h-6 w-6 items-center justify-center rounded text-sentinel-text-muted hover:text-sentinel-text disabled:opacity-30 transition-colors"
                  >
                    <SkipBack className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={clsx(
                      "flex h-6 w-6 items-center justify-center rounded transition-colors",
                      isPlaying
                        ? "text-sentinel-accent"
                        : "text-sentinel-text-muted hover:text-sentinel-text",
                    )}
                  >
                    {isPlaying ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const idx = Math.min(DATES.length - 1, currentDateIndex + 1);
                      onDateChange(DATES[idx]);
                    }}
                    disabled={currentDateIndex >= DATES.length - 1}
                    className="flex h-6 w-6 items-center justify-center rounded text-sentinel-text-muted hover:text-sentinel-text disabled:opacity-30 transition-colors"
                  >
                    <SkipForward className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex-1 flex items-center gap-2">
                  <span className="font-mono text-[9px] tabular-nums text-sentinel-text-muted w-[52px]">
                    {DATES[0]?.slice(5) || ""}
                  </span>
                  <div className="flex-1 relative h-6 flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={DATES.length - 1}
                      value={currentDateIndex >= 0 ? currentDateIndex : 0}
                      onChange={(e) => onDateChange(DATES[Number(e.target.value)])}
                      className="timeline-slider w-full"
                    />
                  </div>
                  <span className="font-mono text-[9px] tabular-nums text-sentinel-text-muted w-[52px] text-right">
                    {DATES[DATES.length - 1]?.slice(5) || ""}
                  </span>
                </div>

                <span className="font-mono text-[10px] tabular-nums text-sentinel-text font-medium bg-sentinel-bg px-2 py-0.5 rounded">
                  {selectedDate}
                </span>
              </div>
            )}

            {/* Legend + animation toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2">
              <MapLegend />
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setAnimationsEnabled(!animationsEnabled)}
                  className={clsx(
                    "rounded px-2 py-1 text-[10px] font-medium tracking-wide transition-colors",
                    animationsEnabled
                      ? "text-sentinel-text-secondary"
                      : "text-sentinel-text-muted",
                  )}
                  title="Toggle animations"
                >
                  {animationsEnabled ? "FX ON" : "FX OFF"}
                </button>
                {activeRiskFilters.size < 4 && (
                  <>
                    <div className="h-4 w-px bg-sentinel-border" />
                    <button
                      onClick={() =>
                        setActiveRiskFilters(new Set(RISK_LEVELS))
                      }
                      className="flex items-center gap-1 text-[10px] text-sentinel-text-muted hover:text-sentinel-text transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - enhanced event detail */}
        <div
          className={clsx(
            "shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l border-sentinel-border bg-sentinel-surface transition-[width] duration-200",
            sidebarCollapsed ? "w-full md:w-10" : "w-full md:w-80",
          )}
        >
          {/* Collapse toggle (desktop) */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-full items-center justify-center py-1 text-sentinel-text-muted hover:text-sentinel-text transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5 rotate-90" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 -rotate-90" />
            )}
          </button>

          {!sidebarCollapsed && selectedCountry && detailEvents.length > 0 ? (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-text-muted">
                    {COUNTRY_NAMES[selectedCountry] || selectedCountry}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-sentinel-text">
                    {detailEvents.length} event
                    {detailEvents.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCountry(null)}
                  className="rounded p-1.5 text-sentinel-text-muted hover:bg-sentinel-surface-hover hover:text-sentinel-text transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Risk distribution bar */}
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-sentinel-bg">
                {RISK_LEVELS.map((level) => {
                  const count = detailEvents.filter(
                    (e) => e.risk_category === level,
                  ).length;
                  if (count === 0) return null;
                  return (
                    <div
                      key={level}
                      className="h-full"
                      style={{
                        width: `${(count / detailEvents.length) * 100}%`,
                        backgroundColor: RISK_COLORS[level].dot,
                      }}
                    />
                  );
                })}
              </div>

              {/* Disease breakdown */}
              {diseaseSummary.length > 0 && (
                <div className="mt-4">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-text-muted mb-2">
                    Disease Breakdown
                  </div>
                  <div className="space-y-1.5">
                    {diseaseSummary.map(([disease, info]) => (
                      <div
                        key={disease}
                        className="flex items-center gap-2 text-[11px]"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: RISK_COLORS[info.maxRisk].dot,
                          }}
                        />
                        <span className="flex-1 text-sentinel-text-secondary truncate">
                          {disease}
                        </span>
                        <span className="tabular-nums font-mono text-[10px] text-sentinel-text-muted">
                          {info.count}x
                        </span>
                        {info.cases > 0 && (
                          <span className="tabular-nums font-mono text-[9px] text-sentinel-text-muted flex items-center gap-0.5">
                            <Users className="h-2.5 w-2.5" />
                            {info.cases.toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events list */}
              <div className="mt-4 space-y-3">
                {detailEvents
                  .sort((a, b) => b.risk_score - a.risk_score)
                  .map((evt) => (
                    <div
                      key={evt.id}
                      className="group rounded-lg border border-sentinel-border bg-sentinel-bg p-3 hover:border-sentinel-border transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Badge label={evt.source} variant="source" />
                        <RiskPill
                          score={evt.risk_score}
                          category={evt.risk_category}
                        />
                      </div>
                      <div className="mt-2 text-[12px] font-medium leading-snug text-sentinel-text">
                        {evt.title}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[11px] text-sentinel-text-secondary">
                          {evt.disease}
                        </span>
                        {evt.species !== "human" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-sentinel-surface-hover text-sentinel-text-muted">
                            {evt.species}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-sentinel-text-muted">
                        {evt.date_reported}
                      </div>
                      {(evt.case_count !== null || evt.death_count !== null) && (
                        <div className="mt-1.5 flex gap-3 text-[10px] tabular-nums text-sentinel-text-muted">
                          {evt.case_count !== null && (
                            <span className="flex items-center gap-1">
                              <Users className="h-2.5 w-2.5" />
                              {evt.case_count.toLocaleString()}
                            </span>
                          )}
                          {evt.death_count !== null && (
                            <span className="flex items-center gap-1 text-sentinel-critical">
                              <Skull className="h-2.5 w-2.5" />
                              {evt.death_count.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Swiss relevance */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-sentinel-text-muted">
                          CH
                        </span>
                        <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-sentinel-surface">
                          <div
                            className="h-full rounded-full bg-sentinel-accent transition-[width] duration-300"
                            style={{
                              width: `${evt.swiss_relevance * 10}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[9px] tabular-nums text-sentinel-text-muted">
                          {evt.swiss_relevance}
                        </span>
                      </div>
                      {/* Link to triage */}
                      <a
                        href={`/triage?event=${evt.id}`}
                        className="mt-2 flex items-center gap-1 text-[10px] text-sentinel-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-sentinel-text"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        View in Triage
                      </a>
                    </div>
                  ))}
              </div>
            </div>
          ) : !sidebarCollapsed ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-sentinel-border bg-sentinel-bg">
                  <TrendingUp className="h-5 w-5 text-sentinel-text-muted" />
                </div>
                <div className="text-[11px] font-medium text-sentinel-text-muted">
                  Select a country to view event details
                </div>
                <div className="mt-1.5 text-[10px] text-sentinel-text-muted opacity-60">
                  Click any highlighted country on the map
                </div>
                {/* Quick stats when no country selected */}
                {filteredEvents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-text-muted">
                      Top Diseases
                    </div>
                    {(() => {
                      const diseases: Record<string, { count: number; risk: RiskCategory }> = {};
                      for (const evt of filteredEvents) {
                        if (!diseases[evt.disease])
                          diseases[evt.disease] = { count: 0, risk: "LOW" };
                        diseases[evt.disease].count++;
                        if (
                          RISK_ORDER[evt.risk_category] >
                          RISK_ORDER[diseases[evt.disease].risk]
                        )
                          diseases[evt.disease].risk = evt.risk_category;
                      }
                      return Object.entries(diseases)
                        .sort(
                          (a, b) =>
                            RISK_ORDER[b[1].risk] - RISK_ORDER[a[1].risk] ||
                            b[1].count - a[1].count,
                        )
                        .slice(0, 6)
                        .map(([disease, info]) => (
                          <div
                            key={disease}
                            className="flex items-center gap-2 text-[10px]"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: RISK_COLORS[info.risk].dot,
                              }}
                            />
                            <span className="flex-1 text-left text-sentinel-text-secondary truncate">
                              {disease}
                            </span>
                            <span className="tabular-nums font-mono text-sentinel-text-muted">
                              {info.count}
                            </span>
                          </div>
                        ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
