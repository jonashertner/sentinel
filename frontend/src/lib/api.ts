import type { HealthEvent, RiskCategory, Situation, Watchlist } from "./types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const DATA_BASE = process.env.NEXT_PUBLIC_DATA_PATH || `${BASE_PATH}/data`;

interface Manifest {
  event_dates: string[];
  situation_ids: string[];
  report_dates: string[];
  total_events: number;
  latest_collection: string;
}

let _manifestCache: Manifest | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

async function getManifest(): Promise<Manifest> {
  if (_manifestCache) return _manifestCache;
  _manifestCache = await fetchJson<Manifest>("/manifest.json");
  return _manifestCache;
}

function deriveRiskCategory(score: number): RiskCategory {
  if (score >= 8) return "CRITICAL";
  if (score >= 6) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}

function enrichEvent(event: HealthEvent): HealthEvent {
  if (!event.risk_category) {
    return { ...event, risk_category: deriveRiskCategory(event.risk_score) };
  }
  return event;
}

export async function loadEvents(date: string): Promise<HealthEvent[]> {
  const events = await fetchJson<HealthEvent[]>(`/events/${date}.json`);
  return events.map(enrichEvent);
}

export async function loadAllEvents(): Promise<HealthEvent[]> {
  const manifest = await getManifest();
  const results = await Promise.allSettled(
    manifest.event_dates.map((d) => loadEvents(d)),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function loadSituations(): Promise<Situation[]> {
  const manifest = await getManifest();
  const results = await Promise.allSettled(
    manifest.situation_ids.map((id) =>
      fetchJson<Situation>(`/situations/${id}.json`),
    ),
  );
  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Situation>).value);
}

export async function loadWatchlists(): Promise<Watchlist[]> {
  return fetchJson("/watchlists.json");
}

export async function loadReport(date: string): Promise<string> {
  const res = await fetch(`${DATA_BASE}/reports/${date}-daily.md`);
  if (!res.ok) return "";
  return res.text();
}

export async function loadLatestReport(): Promise<string> {
  const manifest = await getManifest();
  const dates = manifest.report_dates;
  if (dates.length === 0) return "";
  return loadReport(dates[dates.length - 1]);
}

export { getManifest };
export type { Manifest };
