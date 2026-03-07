import type { HealthEvent, RiskCategory, Situation, Watchlist } from "./types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const DATA_BASE = process.env.NEXT_PUBLIC_DATA_PATH || `${BASE_PATH}/data`;
const MAX_EVENT_AGE_DAYS = Number(process.env.NEXT_PUBLIC_MAX_EVENT_AGE_DAYS || "30");
const ALLOW_WHO_EIOS = process.env.NEXT_PUBLIC_ALLOW_WHO_EIOS === "true";

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

  return {
    ...event,
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
    source_evidence: event.source_evidence || deriveSourceEvidence(event),
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

function isTrustedSourceUrl(event: HealthEvent): boolean {
  const host = (() => {
    try {
      return new URL(event.url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (!host) return false;
  const allowed: Partial<Record<HealthEvent["source"], string[]>> = {
    WHO_DON: ["who.int"],
    ECDC: ["ecdc.europa.eu"],
    WOAH: ["woah.org"],
    PROMED: ["promedmail.org"],
    CIDRAP: ["cidrap.umn.edu"],
    BEACON: ["healthmap.org", "beacon.healthmap.org"],
  };
  const domains = allowed[event.source];
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
    return isTrustedSourceUrl(event);
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
