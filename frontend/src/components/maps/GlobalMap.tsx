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

const DATES = [
  "2026-03-01",
  "2026-03-02",
  "2026-03-03",
  "2026-03-04",
  "2026-03-05",
  "2026-03-06",
];

/* ---------- Types ---------- */

interface GlobalMapProps {
  events: HealthEvent[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

interface TooltipState {
  x: number;
  y: number;
  country: string;
  count: number;
  risk: RiskCategory;
}

/* ---------- Component ---------- */

export function GlobalMap({
  events,
  selectedDate,
  onDateChange,
}: GlobalMapProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  // --- Zoom / Pan state ---
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const isPanning = useRef(false);
  const panStart = useRef<[number, number]>([0, 0]);
  const panOffset = useRef<[number, number]>([0, 0]);

  // --- Projection & Path Generator ---
  const { projection, pathGenerator, graticule } = useMemo(() => {
    const proj = geoNaturalEarth1()
      .center([8.2, 46.8]) // Switzerland
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

  // --- Build ID → alpha2 lookup ---
  const idToAlpha2 = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [numericId, alpha2] of Object.entries(NUMERIC_TO_ALPHA2)) {
      map[numericId] = alpha2;
    }
    return map;
  }, []);

  // --- Group events by country ---
  const countryEvents = useMemo(() => {
    const map: Record<string, HealthEvent[]> = {};
    for (const evt of events) {
      for (const cc of evt.countries) {
        if (!map[cc]) map[cc] = [];
        map[cc].push(evt);
      }
    }
    return map;
  }, [events]);

  const activeCountries = useMemo(
    () => new Set(Object.keys(countryEvents)),
    [countryEvents],
  );

  // --- Selected country events ---
  const detailEvents = selectedCountry
    ? countryEvents[selectedCountry] || []
    : [];

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
      // Only show arcs for neighbors with HIGH+ or any country with CRITICAL
      const isNeighbor = SWISS_NEIGHBORS.includes(cc);
      if (
        !isNeighbor &&
        RISK_ORDER[maxRisk] < RISK_ORDER["HIGH"]
      )
        continue;
      const fromPos = projectedCentroids[cc];
      if (!fromPos) continue;
      // Deterministic pseudo-random duration based on index
      seed += 1;
      const dur = 3 + (seed % 5) * 0.4;
      arcs.push({
        from: cc,
        fromPos,
        toPos: chPos,
        risk: maxRisk,
        count: evts.length,
        dur,
      });
    }

    return arcs.sort(
      (a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk],
    );
  }, [countryEvents, projectedCentroids, chPos]);

  // --- Arc path generator (quadratic bezier) ---
  const getArcPath = useCallback(
    (from: [number, number], to: [number, number]) => {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Control point perpendicular to midpoint
      const mx = (from[0] + to[0]) / 2;
      const my = (from[1] + to[1]) / 2;
      const curvature = Math.min(dist * 0.3, 80);
      // Perpendicular direction
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

  // --- Outline (sphere) ---
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
        count: (countryEvents[cc] || []).length,
        risk: getMaxRisk(countryEvents[cc] || []),
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
    },
    [activeCountries, selectedCountry],
  );

  // --- Zoom handlers ---
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom((z) => Math.min(Math.max(z + delta, 0.5), 8));
    },
    [],
  );

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

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current[0];
      const dy = e.clientY - panStart.current[1];
      setPan([panOffset.current[0] + dx, panOffset.current[1] + dy]);
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan([0, 0]);
  }, []);

  // --- Container measurement for responsive ---
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {});
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stats
  const criticalCount = events.filter(
    (e) => e.risk_category === "CRITICAL",
  ).length;
  const highCount = events.filter((e) => e.risk_category === "HIGH").length;

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
                {/* Glow filter for Switzerland */}
                <filter id="glow-ch" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Glow for critical markers */}
                <filter id="glow-critical" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Radial gradient for country highlights */}
                <radialGradient id="ch-glow-gradient">
                  <stop offset="0%" stopColor="var(--sentinel-accent)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--sentinel-accent)" stopOpacity="0" />
                </radialGradient>
                {/* Arc gradient */}
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
                    <stop
                      offset="0%"
                      stopColor={RISK_COLORS[arc.risk].dot}
                      stopOpacity="0.6"
                    />
                    <stop
                      offset="100%"
                      stopColor={RISK_COLORS[arc.risk].dot}
                      stopOpacity="0.15"
                    />
                  </linearGradient>
                ))}
              </defs>

              <g transform={`translate(${480 + pan[0]}, ${260 + pan[1]}) scale(${zoom}) translate(-480, -260)`}>

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

              {/* Country paths */}
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

                return (
                  <path
                    key={id}
                    d={d}
                    fill={
                      isCH
                        ? hasEvents && color
                          ? `${color}25`
                          : "var(--sentinel-surface-hover)"
                        : hasEvents && color
                          ? `${color}18`
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
                      alpha2
                        ? () => handleCountryClick(alpha2)
                        : undefined
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
                  {/* Pulsing ring around Switzerland */}
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
                  {/* Static ring */}
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

              {/* Threat arcs */}
              {animationsEnabled &&
                threatArcs.map((arc) => {
                  const d = getArcPath(arc.fromPos, arc.toPos);
                  const thickness = Math.min(1 + arc.count * 0.5, 3);
                  return (
                    <g key={`arc-${arc.from}`} className="pointer-events-none">
                      {/* Arc line */}
                      <path
                        d={d}
                        fill="none"
                        stroke={`url(#arc-grad-${arc.from})`}
                        strokeWidth={thickness}
                        strokeDasharray="6 4"
                        className="animate-threat-arc"
                      />
                      {/* Traveling dot */}
                      <circle r={2} fill={RISK_COLORS[arc.risk].dot} opacity={0.9}>
                        <animateMotion
                          dur={`${arc.dur}s`}
                          repeatCount="indefinite"
                          path={d}
                        />
                      </circle>
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
                    {/* Outer pulse ring */}
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
                    {/* Main dot */}
                    <circle
                      cx={pos[0]}
                      cy={pos[1]}
                      r={radius * 0.6}
                      fill={color}
                      opacity={0.85}
                    />
                    {/* Inner bright core */}
                    <circle
                      cx={pos[0]}
                      cy={pos[1]}
                      r={radius * 0.25}
                      fill="#fff"
                      opacity={0.6}
                    />
                    {/* Count label */}
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

              </g>{/* Close zoom transform group */}
            </svg>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="map-tooltip"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: RISK_COLORS[tooltip.risk].dot,
                    }}
                  />
                  <span className="font-medium">
                    {COUNTRY_NAMES[tooltip.country] || tooltip.country}
                  </span>
                  <span className="text-sentinel-text-muted">
                    {tooltip.count} event{tooltip.count !== 1 ? "s" : ""}
                  </span>
                </div>
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
            <div className="absolute left-4 top-4 flex flex-col gap-2">
              <div className="rounded border border-sentinel-border bg-sentinel-surface/90 px-3 py-2 backdrop-blur-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sentinel-text-muted">
                  Global Events
                </div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-sentinel-text">
                  {events.length}
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
          </div>

          {/* Bottom bar: legend + date selector + animation toggle */}
          <div className="flex items-center justify-between border-t border-sentinel-border bg-sentinel-surface px-4 py-2.5">
            <MapLegend />
            <div className="flex items-center gap-3">
              {/* Animation toggle */}
              <button
                onClick={() => setAnimationsEnabled(!animationsEnabled)}
                className={clsx(
                  "rounded px-2 py-1 text-[10px] font-medium tracking-wide",
                  animationsEnabled
                    ? "text-sentinel-text-secondary"
                    : "text-sentinel-text-muted",
                )}
                title="Toggle animations"
              >
                {animationsEnabled ? "FX ON" : "FX OFF"}
              </button>
              <div className="h-4 w-px bg-sentinel-border" />
              {/* Date selector */}
              <div className="flex items-center gap-1">
                {DATES.map((d) => (
                  <button
                    key={d}
                    onClick={() => onDateChange(d)}
                    className={clsx(
                      "rounded px-2 py-1 font-mono text-[10px] tabular-nums",
                      d === selectedDate
                        ? "bg-sentinel-text text-sentinel-bg"
                        : "text-sentinel-text-muted hover:bg-sentinel-surface-hover hover:text-sentinel-text-secondary",
                    )}
                  >
                    {d.slice(5)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - event detail */}
        <div className="w-full md:w-80 shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l border-sentinel-border bg-sentinel-surface">
          {selectedCountry && detailEvents.length > 0 ? (
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
                  className="rounded px-2 py-1 text-[10px] text-sentinel-text-muted hover:bg-sentinel-surface-hover hover:text-sentinel-text"
                >
                  Close
                </button>
              </div>

              {/* Risk distribution bar */}
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-sentinel-bg">
                {(
                  ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as RiskCategory[]
                ).map((level) => {
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

              <div className="mt-4 space-y-3">
                {detailEvents
                  .sort((a, b) => b.risk_score - a.risk_score)
                  .map((evt) => (
                    <div
                      key={evt.id}
                      className="rounded-lg border border-sentinel-border bg-sentinel-bg p-3"
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
                      <div className="mt-1.5 text-[11px] text-sentinel-text-secondary">
                        {evt.disease}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-sentinel-text-muted">
                        {evt.date_reported}
                      </div>
                      {evt.case_count !== null && (
                        <div className="mt-1.5 flex gap-3 text-[10px] tabular-nums text-sentinel-text-muted">
                          <span>
                            Cases: {evt.case_count.toLocaleString()}
                          </span>
                          {evt.death_count !== null && (
                            <span>
                              Deaths: {evt.death_count.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Swiss relevance indicator */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-sentinel-text-muted">
                          CH Relevance
                        </span>
                        <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-sentinel-surface">
                          <div
                            className="h-full rounded-full bg-sentinel-accent"
                            style={{
                              width: `${evt.swiss_relevance * 10}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[9px] tabular-nums text-sentinel-text-muted">
                          {evt.swiss_relevance}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-sentinel-border bg-sentinel-bg">
                  <svg
                    className="h-5 w-5 text-sentinel-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                </div>
                <div className="text-[11px] font-medium text-sentinel-text-muted">
                  Select a country to view event details
                </div>
                <div className="mt-1.5 text-[10px] text-sentinel-text-muted opacity-60">
                  Countries with events are highlighted with risk-colored
                  markers
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
