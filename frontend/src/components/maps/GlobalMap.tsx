"use client";

import { useState, useMemo } from "react";
import { clsx } from "clsx";
import { RISK_COLORS, COUNTRY_NAMES } from "@/lib/constants";
import type { HealthEvent, RiskCategory } from "@/lib/types";
import { RiskPill } from "@/components/ui/RiskPill";
import { Badge } from "@/components/ui/Badge";
import { MapLegend } from "./MapLegend";

/* ---------- simplified SVG world map paths (schematic) ---------- */
// Each country is a simplified polygon. We use a mercator-like projection
// mapped to a 1000x500 viewBox.

const COUNTRY_PATHS: Record<string, { d: string; cx: number; cy: number }> = {
  // Europe
  NL: { d: "M480,155 L490,150 L495,160 L485,165 Z", cx: 487, cy: 157 },
  DE: { d: "M485,165 L505,160 L510,185 L495,190 L485,180 Z", cx: 497, cy: 175 },
  FR: { d: "M460,175 L485,170 L490,195 L475,210 L455,200 Z", cx: 473, cy: 190 },
  IT: { d: "M495,190 L510,185 L515,210 L505,230 L495,215 Z", cx: 505, cy: 207 },
  AT: { d: "M505,175 L525,172 L528,185 L508,188 Z", cx: 516, cy: 180 },
  CH: { d: "M488,185 L500,183 L502,192 L490,194 Z", cx: 495, cy: 188 },
  ES: { d: "M435,200 L465,195 L470,220 L440,225 Z", cx: 452, cy: 210 },
  GB: { d: "M450,145 L465,140 L468,165 L453,168 Z", cx: 459, cy: 154 },
  BE: { d: "M475,162 L487,160 L488,168 L476,170 Z", cx: 481, cy: 165 },
  PL: { d: "M520,155 L545,150 L548,175 L523,178 Z", cx: 534, cy: 164 },
  LI: { d: "M501,184 L504,183 L504,186 L501,187 Z", cx: 502, cy: 185 },
  UZ: { d: "M620,165 L650,158 L655,175 L625,180 Z", cx: 637, cy: 169 },
  TR: { d: "M545,195 L585,188 L590,205 L548,210 Z", cx: 567, cy: 199 },
  // Africa
  ET: { d: "M560,310 L585,305 L590,330 L565,335 Z", cx: 575, cy: 318 },
  NG: { d: "M480,305 L505,300 L508,325 L483,328 Z", cx: 494, cy: 314 },
  CD: { d: "M520,325 L550,318 L555,355 L525,360 Z", cx: 537, cy: 340 },
  BI: { d: "M548,345 L558,343 L560,355 L550,357 Z", cx: 554, cy: 350 },
  RW: { d: "M548,335 L558,333 L560,345 L550,347 Z", cx: 554, cy: 340 },
  KE: { d: "M565,325 L585,320 L588,350 L568,353 Z", cx: 576, cy: 337 },
  TZ: { d: "M560,350 L585,345 L588,380 L563,383 Z", cx: 574, cy: 365 },
  DZ: { d: "M460,240 L500,235 L505,270 L465,275 Z", cx: 482, cy: 255 },
  // Americas
  US: { d: "M120,160 L250,150 L255,220 L125,225 Z", cx: 187, cy: 190 },
  BR: { d: "M230,320 L310,310 L318,400 L238,408 Z", cx: 274, cy: 360 },
  // Asia
  CN: { d: "M680,180 L770,170 L778,240 L688,248 Z", cx: 729, cy: 210 },
  IN: { d: "M650,230 L700,225 L705,300 L655,305 Z", cx: 677, cy: 265 },
  TH: { d: "M720,270 L738,268 L740,305 L722,307 Z", cx: 730, cy: 288 },
  VN: { d: "M740,265 L758,260 L760,305 L742,308 Z", cx: 750, cy: 284 },
  ID: { d: "M730,330 L800,322 L805,355 L735,360 Z", cx: 767, cy: 342 },
  LA: { d: "M730,255 L748,252 L750,272 L732,275 Z", cx: 740, cy: 264 },
  AE: { d: "M600,245 L618,242 L620,258 L602,260 Z", cx: 610, cy: 251 },
};

// WHO regions with countries
const REGIONS: { id: string; label: string; countries: string[] }[] = [
  { id: "EURO", label: "EURO", countries: ["NL", "DE", "FR", "IT", "AT", "CH", "ES", "GB", "BE", "PL", "LI", "UZ", "TR"] },
  { id: "AFRO", label: "AFRO", countries: ["ET", "NG", "CD", "BI", "RW", "KE", "TZ", "DZ"] },
  { id: "AMRO", label: "AMRO", countries: ["US", "BR"] },
  { id: "SEARO", label: "SEARO", countries: ["IN", "TH", "ID"] },
  { id: "WPRO", label: "WPRO", countries: ["CN", "VN", "LA"] },
  { id: "EMRO", label: "EMRO", countries: ["AE"] },
];

function getMaxRisk(events: HealthEvent[]): RiskCategory {
  if (events.some((e) => e.risk_category === "CRITICAL")) return "CRITICAL";
  if (events.some((e) => e.risk_category === "HIGH")) return "HIGH";
  if (events.some((e) => e.risk_category === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

interface GlobalMapProps {
  events: HealthEvent[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const DATES = [
  "2026-03-01",
  "2026-03-02",
  "2026-03-03",
  "2026-03-04",
  "2026-03-05",
  "2026-03-06",
];

export function GlobalMap({ events, selectedDate, onDateChange }: GlobalMapProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Group events by country
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

  // Countries with events
  const activeCountries = useMemo(() => new Set(Object.keys(countryEvents)), [countryEvents]);

  // Selected country's events
  const detailEvents = selectedCountry ? (countryEvents[selectedCountry] || []) : [];

  return (
    <div className="flex h-full flex-col">
      {/* Map area */}
      <div className="flex flex-1 overflow-hidden">
        {/* SVG Map */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative overflow-hidden bg-sentinel-bg">
            <svg
              viewBox="0 0 1000 500"
              className="h-full w-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid lines */}
              {Array.from({ length: 19 }, (_, i) => (
                <line
                  key={`vg-${i}`}
                  x1={(i + 1) * 50}
                  y1={0}
                  x2={(i + 1) * 50}
                  y2={500}
                  stroke="#1e1e21"
                  strokeWidth={0.5}
                />
              ))}
              {Array.from({ length: 9 }, (_, i) => (
                <line
                  key={`hg-${i}`}
                  x1={0}
                  y1={(i + 1) * 50}
                  x2={1000}
                  y2={(i + 1) * 50}
                  stroke="#1e1e21"
                  strokeWidth={0.5}
                />
              ))}

              {/* Equator */}
              <line x1={0} y1={250} x2={1000} y2={250} stroke="#27272a" strokeWidth={1} strokeDasharray="4 4" />

              {/* Region labels */}
              {REGIONS.map((r) => {
                const paths = r.countries
                  .map((c) => COUNTRY_PATHS[c])
                  .filter(Boolean);
                if (paths.length === 0) return null;
                const cx = paths.reduce((s, p) => s + p.cx, 0) / paths.length;
                const cy = Math.min(...paths.map((p) => p.cy)) - 18;
                return (
                  <text
                    key={r.id}
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    className="fill-sentinel-text-muted text-[8px] font-semibold uppercase tracking-[0.2em]"
                    style={{ fontSize: "8px" }}
                  >
                    {r.label}
                  </text>
                );
              })}

              {/* Country shapes */}
              {Object.entries(COUNTRY_PATHS).map(([cc, { d, cx, cy }]) => {
                const hasEvents = activeCountries.has(cc);
                const evts = countryEvents[cc] || [];
                const maxRisk = hasEvents ? getMaxRisk(evts) : null;
                const color = maxRisk ? RISK_COLORS[maxRisk].dot : "#1e1e21";
                const isSelected = selectedCountry === cc;
                const isCH = cc === "CH";

                return (
                  <g key={cc}>
                    <path
                      d={d}
                      fill={hasEvents ? `${color}20` : "#141416"}
                      stroke={isSelected ? "#fafafa" : hasEvents ? color : "#27272a"}
                      strokeWidth={isSelected ? 2 : isCH ? 1.5 : 0.75}
                      className={clsx(
                        hasEvents && "cursor-pointer",
                        !hasEvents && "opacity-40",
                      )}
                      onClick={() => hasEvents && setSelectedCountry(cc === selectedCountry ? null : cc)}
                    />
                    {/* Country label */}
                    <text
                      x={cx}
                      y={cy + 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={clsx(
                        "pointer-events-none font-mono",
                        hasEvents ? "fill-sentinel-text" : "fill-sentinel-text-muted",
                      )}
                      style={{ fontSize: isCH ? "7px" : "6px", fontWeight: isCH ? 700 : hasEvents ? 600 : 400 }}
                    >
                      {cc}
                    </text>
                    {/* Event count bubble */}
                    {hasEvents && evts.length > 0 && (
                      <>
                        <circle
                          cx={cx + 10}
                          cy={cy - 8}
                          r={Math.min(4 + evts.length * 1.5, 10)}
                          fill={color}
                          opacity={0.8}
                          className="pointer-events-none"
                        />
                        <text
                          x={cx + 10}
                          y={cy - 7.5}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="pointer-events-none fill-white font-mono"
                          style={{ fontSize: "5px", fontWeight: 700 }}
                        >
                          {evts.length}
                        </text>
                      </>
                    )}
                    {/* Switzerland highlight ring */}
                    {isCH && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={12}
                        fill="none"
                        stroke="#fafafa"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        className="pointer-events-none"
                        opacity={0.4}
                      />
                    )}
                  </g>
                );
              })}

              {/* Connection lines from border countries to CH */}
              {["DE", "FR", "IT", "AT"].map((cc) => {
                const from = COUNTRY_PATHS[cc];
                const to = COUNTRY_PATHS["CH"];
                if (!from || !to || !activeCountries.has(cc)) return null;
                const evts = countryEvents[cc] || [];
                const maxRisk = getMaxRisk(evts);
                return (
                  <line
                    key={`conn-${cc}`}
                    x1={from.cx}
                    y1={from.cy}
                    x2={to.cx}
                    y2={to.cy}
                    stroke={RISK_COLORS[maxRisk].dot}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.35}
                    className="pointer-events-none"
                  />
                );
              })}
            </svg>

            {/* Map overlay - top stats */}
            <div className="absolute left-4 top-4 flex flex-col gap-2">
              <div className="rounded border border-sentinel-border bg-sentinel-surface/90 px-3 py-2 backdrop-blur-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                  Global Events
                </div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-sentinel-text">
                  {events.length}
                </div>
              </div>
              <div className="rounded border border-sentinel-border bg-sentinel-surface/90 px-3 py-2 backdrop-blur-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                  Countries
                </div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-sentinel-text">
                  {activeCountries.size}
                </div>
              </div>
            </div>
          </div>

          {/* Legend + date selector bar */}
          <div className="flex items-center justify-between border-t border-sentinel-border bg-sentinel-surface px-4 py-2.5">
            <MapLegend />
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

        {/* Right sidebar - event detail */}
        <div className="w-80 shrink-0 border-l border-sentinel-border bg-sentinel-surface overflow-y-auto">
          {selectedCountry && detailEvents.length > 0 ? (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
                    {COUNTRY_NAMES[selectedCountry] || selectedCountry}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-sentinel-text">
                    {detailEvents.length} event{detailEvents.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCountry(null)}
                  className="text-sentinel-text-muted hover:text-sentinel-text text-xs"
                >
                  Close
                </button>
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
                        <RiskPill score={evt.risk_score} category={evt.risk_category} />
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
                          <span>Cases: {evt.case_count.toLocaleString()}</span>
                          {evt.death_count !== null && (
                            <span>Deaths: {evt.death_count.toLocaleString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <div className="text-[11px] font-medium text-sentinel-text-muted">
                  Select a country on the map to view event details
                </div>
                <div className="mt-2 text-[10px] text-sentinel-text-muted opacity-60">
                  Countries with events are highlighted
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
