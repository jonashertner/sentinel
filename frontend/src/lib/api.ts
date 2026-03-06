import type { HealthEvent, Situation, Watchlist } from "./types";

const DATA_BASE = process.env.NEXT_PUBLIC_DATA_PATH || "/data";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

export async function loadEvents(date: string): Promise<HealthEvent[]> {
  return fetchJson(`/events/${date}.json`);
}

export async function loadAllEvents(): Promise<HealthEvent[]> {
  const dates = [
    "2026-03-01",
    "2026-03-02",
    "2026-03-03",
    "2026-03-04",
    "2026-03-05",
    "2026-03-06",
  ];
  const results = await Promise.allSettled(dates.map((d) => loadEvents(d)));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function loadSituations(): Promise<Situation[]> {
  const ids = ["sit-001-h5n1-europe", "sit-002-dengue-sea", "sit-003-mpox-1b"];
  const results = await Promise.allSettled(
    ids.map((id) => fetchJson<Situation>(`/situations/${id}.json`)),
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
