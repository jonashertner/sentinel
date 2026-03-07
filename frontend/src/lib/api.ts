import type {
  CollectorStatus,
  EventOpsState,
  HealthEvent,
  IngestionDelta,
  RiskCategory,
  Situation,
  SituationOpsState,
  TriageStatus,
  Watchlist,
} from "./types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const DATA_BASE = process.env.NEXT_PUBLIC_DATA_PATH || `${BASE_PATH}/data`;
const API_ROOT = (process.env.NEXT_PUBLIC_API_BASE || BASE_PATH || "").replace(/\/$/, "");
const API_WRITE_KEY = process.env.NEXT_PUBLIC_API_WRITE_KEY || "";
const MAX_EVENT_AGE_DAYS = Number(process.env.NEXT_PUBLIC_MAX_EVENT_AGE_DAYS || "30");
const ALLOW_WHO_EIOS = process.env.NEXT_PUBLIC_ALLOW_WHO_EIOS === "true";
const ECDC_LEGACY_URL_OVERRIDES: Record<string, string> = {
  "h5n1-threat-assessment-march2026": "https://www.ecdc.europa.eu/en/avian-influenza",
};
const SOURCE_LANDING_PAGES: Record<HealthEvent["source"], string> = {
  WHO_DON: "https://www.who.int/emergencies/disease-outbreak-news",
  WHO_EIOS: "https://www.who.int/initiatives/eios",
  ECDC: "https://www.ecdc.europa.eu/en",
  WOAH: "https://www.woah.org/",
  PROMED: "https://promedmail.org/",
  CIDRAP: "https://www.cidrap.umn.edu/",
  BEACON: "https://beacon.healthmap.org/",
};

interface Manifest {
  event_dates: string[];
  situation_ids: string[];
  report_dates: string[];
  total_events: number;
  latest_collection: string;
  projected_source_totals?: Record<string, number>;
  collector_statuses?: CollectorStatus[];
  ingestion_delta?: IngestionDelta;
}

interface CollectorHealthSnapshot {
  run_date: string;
  statuses: CollectorStatus[];
}

interface IngestionDeltaSnapshot {
  run_date: string;
  delta: IngestionDelta;
}

let _manifestCache: Manifest | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function apiHeaders(withJson = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (withJson) headers["Content-Type"] = "application/json";
  if (API_WRITE_KEY) headers["X-API-Key"] = API_WRITE_KEY;
  return headers;
}

async function fetchApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ROOT}${path}`, init);
  if (!res.ok) throw new Error(`API request failed: ${path}`);
  return res.json();
}

async function tryApiJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await fetchApiJson<T>(path, init);
  } catch {
    return null;
  }
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

function deriveSourceEvidence(event: HealthEvent): HealthEvent["source_evidence"] {
  return [
    {
      source: event.source,
      event_id: event.id,
      url: event.url,
      title: event.title,
      date_reported: event.date_reported,
      confidence: deriveConfidence({
        source: event.source,
        verification_status: event.verification_status || "UNVERIFIED",
      }),
    },
  ];
}

function normalizeSourceUrl(source: HealthEvent["source"], url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return SOURCE_LANDING_PAGES[source];

  let parsed: URL;
  try {
    if (trimmed.startsWith("//")) {
      parsed = new URL(`https:${trimmed}`);
    } else if (!trimmed.includes("://") && trimmed.startsWith("www.")) {
      parsed = new URL(`https://${trimmed}`);
    } else {
      parsed = new URL(trimmed);
    }
  } catch {
    return SOURCE_LANDING_PAGES[source];
  }

  const host = parsed.hostname.toLowerCase();
  if (source === "ECDC" && host === "www.ecdc.europa.eu") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    const override = ECDC_LEGACY_URL_OVERRIDES[slug];
    if (override) return override;
    if (parts.length >= 4 && parts[0] === "en" && parts[parts.length - 2] === "threats") {
      return `https://www.ecdc.europa.eu/en/news-events/${slug}`;
    }
  }

  const query = new URLSearchParams(parsed.search);
  const cleaned = new URLSearchParams();
  for (const [key, value] of query.entries()) {
    if (!key.toLowerCase().startsWith("utm_")) cleaned.append(key, value);
  }
  parsed.protocol = "https:";
  parsed.search = cleaned.toString();
  parsed.hash = "";
  return parsed.toString();
}

function deriveConfidence(event: Pick<HealthEvent, "source" | "verification_status">): number {
  const sourceBase: Record<HealthEvent["source"], number> = {
    WHO_DON: 0.95,
    ECDC: 0.95,
    WOAH: 0.9,
    CIDRAP: 0.8,
    PROMED: 0.75,
    BEACON: 0.7,
    WHO_EIOS: 0.6,
  };
  let confidence = sourceBase[event.source] ?? 0.6;
  if (event.verification_status === "CONFIRMED") confidence += 0.03;
  if (event.verification_status === "PENDING") confidence -= 0.05;
  if (event.verification_status === "UNVERIFIED") confidence -= 0.1;
  if (event.verification_status === "REFUTED") confidence = 0.1;
  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
}

function enrichEvent(event: HealthEvent): HealthEvent {
  const riskCategory = event.risk_category || deriveRiskCategory(event.risk_score);
  const verificationStatus = event.verification_status || "UNVERIFIED";
  const operationalPriority = event.operational_priority ?? "ROUTINE";
  const imsActivation = event.ims_activation ?? "MONITORING";
  const leadAgency = event.lead_agency ?? "JOINT";
  const hazardClass = event.hazard_class ?? "GENERAL";
  const playbook = event.playbook ?? "GENERAL_MONITORING";
  const escalationLevel = event.escalation_level ?? "ROUTINE_SURVEILLANCE";
  const playbookSLA = event.playbook_sla_hours ?? event.sla_timer_hours ?? 168;
  const escalationWorkflow = event.escalation_workflow ?? [];
  const decisionWindow = event.decision_window_hours ?? 168;
  const url = normalizeSourceUrl(event.source, event.url);

  return {
    ...event,
    url,
    risk_category: riskCategory,
    verification_status: verificationStatus,
    ihr_unusual: event.ihr_unusual ?? null,
    ihr_serious_impact: event.ihr_serious_impact ?? null,
    ihr_international_spread: event.ihr_international_spread ?? null,
    ihr_trade_travel_risk: event.ihr_trade_travel_risk ?? null,
    confidence_score: event.confidence_score ?? deriveConfidence({ source: event.source, verification_status: verificationStatus }),
    probability_score: event.probability_score ?? Math.min(5, Math.max(0, Math.round((event.swiss_relevance / 2) * 10) / 10)),
    impact_score: event.impact_score ?? Math.min(5, Math.max(0, Math.round((event.risk_score / 2) * 10) / 10)),
    operational_priority: operationalPriority,
    ims_activation: imsActivation,
    lead_agency: leadAgency,
    decision_window_hours: decisionWindow,
    trigger_flags: event.trigger_flags || [],
    recommended_actions: event.recommended_actions || [],
    merged_from: event.merged_from || [event.id],
    source_evidence: (event.source_evidence || deriveSourceEvidence(event)).map((e) => ({
      ...e,
      url: normalizeSourceUrl(e.source, e.url),
    })),
    provenance_hash: event.provenance_hash || `legacy-${event.id}`,
    analyst_overrides: event.analyst_overrides || [],
    hazard_class: hazardClass,
    playbook,
    playbook_sla_hours: playbookSLA,
    sla_timer_hours: event.sla_timer_hours ?? playbookSLA,
    escalation_level: escalationLevel,
    escalation_workflow: escalationWorkflow,
  };
}

function deduplicateByLatest(events: HealthEvent[]): HealthEvent[] {
  const latest = new Map<string, HealthEvent>();
  for (const event of events) {
    const existing = latest.get(event.id);
    if (!existing || event.date_collected > existing.date_collected) {
      latest.set(event.id, event);
    }
  }
  return [...latest.values()];
}

function isTrustedSourceUrl(source: HealthEvent["source"], url: string): boolean {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (!host) return false;
  const allowed: Partial<Record<HealthEvent["source"], string[]>> = {
    WHO_DON: ["who.int"],
    WHO_EIOS: ["who.int"],
    ECDC: ["ecdc.europa.eu"],
    WOAH: ["woah.org"],
    PROMED: ["promedmail.org"],
    CIDRAP: ["cidrap.umn.edu"],
    BEACON: ["healthmap.org", "beacon.healthmap.org"],
  };
  const domains = allowed[source];
  if (!domains) return true;
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function filterByDataQuality(
  events: HealthEvent[],
  referenceDateIso?: string,
): HealthEvent[] {
  const reference = referenceDateIso
    ? new Date(`${referenceDateIso}T00:00:00Z`)
    : new Date();
  const cutoff = new Date(reference);
  cutoff.setUTCDate(cutoff.getUTCDate() - MAX_EVENT_AGE_DAYS);
  return events.filter((event) => {
    if (event.source === "WHO_EIOS" && !ALLOW_WHO_EIOS) return false;
    const reported = new Date(`${event.date_reported}T00:00:00Z`);
    if (Number.isNaN(reported.getTime())) return false;
    if (MAX_EVENT_AGE_DAYS > 0 && (reported < cutoff || reported > reference)) return false;
    return isTrustedSourceUrl(event.source, event.url);
  });
}

export async function loadEvents(date: string): Promise<HealthEvent[]> {
  const events = await fetchJson<HealthEvent[]>(`/events/${date}.json`);
  return filterByDataQuality(events.map(enrichEvent), date);
}

export async function loadAllEvents(): Promise<HealthEvent[]> {
  const manifest = await getManifest();
  const results = await Promise.allSettled(
    manifest.event_dates.map((d) => loadEvents(d)),
  );
  const events = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return filterByDataQuality(
    deduplicateByLatest(events),
    manifest.latest_collection,
  );
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
  const api = await tryApiJson<Watchlist[]>("/api/watchlists");
  if (api) return api;
  return fetchJson("/watchlists.json");
}

export async function createWatchlist(watchlist: Watchlist): Promise<Watchlist | null> {
  return tryApiJson<Watchlist>("/api/watchlists", {
    method: "POST",
    headers: apiHeaders(true),
    body: JSON.stringify(watchlist),
  });
}

export async function deleteWatchlist(watchlistId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_ROOT}/api/watchlists/${watchlistId}`, {
      method: "DELETE",
      headers: apiHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadEventOpsState(eventId: string): Promise<EventOpsState | null> {
  return tryApiJson<EventOpsState>(`/api/operations/events/${eventId}`);
}

export async function saveEventOpsState(
  eventId: string,
  input: { triage_status: TriageStatus | null; note: string; updated_by: string },
): Promise<EventOpsState | null> {
  return tryApiJson<EventOpsState>(`/api/operations/events/${eventId}`, {
    method: "PUT",
    headers: apiHeaders(true),
    body: JSON.stringify(input),
  });
}

export async function loadSituationOpsState(situationId: string): Promise<SituationOpsState | null> {
  return tryApiJson<SituationOpsState>(`/api/operations/situations/${situationId}`);
}

export async function addSituationAnnotation(
  situationId: string,
  input: { author: string; content: string },
): Promise<SituationOpsState | null> {
  return tryApiJson<SituationOpsState>(`/api/operations/situations/${situationId}/annotations`, {
    method: "POST",
    headers: apiHeaders(true),
    body: JSON.stringify(input),
  });
}

export async function saveSituationActions(
  situationId: string,
  input: { checked_action_indices: number[]; updated_by: string },
): Promise<SituationOpsState | null> {
  return tryApiJson<SituationOpsState>(`/api/operations/situations/${situationId}/actions`, {
    method: "PUT",
    headers: apiHeaders(true),
    body: JSON.stringify(input),
  });
}

export async function loadCollectorHealth(): Promise<CollectorHealthSnapshot | null> {
  const api = await tryApiJson<CollectorHealthSnapshot>("/api/analytics/collector-health");
  if (api && Array.isArray(api.statuses)) return api;

  const manifest = await getManifest();
  if (manifest.collector_statuses && manifest.collector_statuses.length > 0) {
    return {
      run_date: manifest.latest_collection,
      statuses: manifest.collector_statuses,
    };
  }
  return null;
}

export async function loadIngestionDelta(): Promise<IngestionDelta | null> {
  const api = await tryApiJson<IngestionDeltaSnapshot>("/api/analytics/ingestion-delta");
  if (api?.delta) return api.delta;

  const manifest = await getManifest();
  return manifest.ingestion_delta || null;
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
export type { CollectorHealthSnapshot, Manifest };
