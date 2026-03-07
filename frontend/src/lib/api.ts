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

function deriveOperationalPriority(
  event: Pick<HealthEvent, "risk_score" | "swiss_relevance">,
): HealthEvent["operational_priority"] {
  if (event.risk_score >= 8 || (event.risk_score >= 6 && event.swiss_relevance >= 6)) return "CRITICAL";
  if (event.risk_score >= 6 || event.swiss_relevance >= 5) return "HIGH";
  if (event.risk_score >= 4 || event.swiss_relevance >= 3) return "ELEVATED";
  return "ROUTINE";
}

function deriveIMSActivation(priority: HealthEvent["operational_priority"]): HealthEvent["ims_activation"] {
  if (priority === "CRITICAL") return "FULL_ACTIVATION";
  if (priority === "HIGH") return "PARTIAL_ACTIVATION";
  if (priority === "ELEVATED") return "ENHANCED_MONITORING";
  return "MONITORING";
}

function deriveLeadAgency(event: Pick<HealthEvent, "species" | "one_health_tags">): HealthEvent["lead_agency"] {
  if (event.species === "both") return "JOINT";
  if (event.one_health_tags.includes("zoonotic") || event.one_health_tags.includes("foodborne")) {
    return "JOINT";
  }
  if (event.species === "animal") return "BLV";
  return "BAG";
}

function deriveHazardClass(event: Pick<HealthEvent, "disease" | "one_health_tags" | "species" | "title" | "summary">): HealthEvent["hazard_class"] {
  const respiratory = new Set([
    "COVID-19",
    "MERS",
    "Influenza A(H1N1)",
    "Avian influenza",
    "Avian influenza A(H5N1)",
    "Avian influenza A(H5N6)",
    "Avian influenza A(H7N9)",
  ]);
  const text = `${event.title} ${event.summary}`.toLowerCase();

  if (event.one_health_tags.includes("foodborne")) return "FOODBORNE";
  if (event.one_health_tags.includes("vector-borne")) return "VECTOR_BORNE";
  if (event.one_health_tags.includes("zoonotic") || event.species === "animal" || event.species === "both") {
    return "ZOONOTIC_SPILLOVER";
  }
  if (respiratory.has(event.disease) || text.includes("respir")) return "PANDEMIC_RESPIRATORY";
  return "GENERAL";
}

function derivePlaybook(hazardClass: HealthEvent["hazard_class"]): HealthEvent["playbook"] {
  if (hazardClass === "PANDEMIC_RESPIRATORY") return "PANDEMIC_RESPIRATORY";
  if (hazardClass === "ZOONOTIC_SPILLOVER") return "ZOONOTIC_SPILLOVER";
  if (hazardClass === "FOODBORNE") return "FOODBORNE_CONTAINMENT";
  if (hazardClass === "VECTOR_BORNE") return "VECTOR_CONTROL";
  return "GENERAL_MONITORING";
}

function deriveEscalationLevel(priority: HealthEvent["operational_priority"]): HealthEvent["escalation_level"] {
  if (priority === "CRITICAL") return "NATIONAL_CRISIS";
  if (priority === "HIGH") return "FEDERAL_ESCALATION";
  if (priority === "ELEVATED") return "INTERAGENCY_COORDINATION";
  return "ROUTINE_SURVEILLANCE";
}

function derivePlaybookSLA(
  playbook: HealthEvent["playbook"],
  priority: HealthEvent["operational_priority"],
): number {
  const matrix: Record<HealthEvent["playbook"], Record<HealthEvent["operational_priority"], number>> = {
    PANDEMIC_RESPIRATORY: { CRITICAL: 4, HIGH: 12, ELEVATED: 24, ROUTINE: 72 },
    ZOONOTIC_SPILLOVER: { CRITICAL: 6, HIGH: 24, ELEVATED: 48, ROUTINE: 96 },
    FOODBORNE_CONTAINMENT: { CRITICAL: 8, HIGH: 24, ELEVATED: 48, ROUTINE: 120 },
    VECTOR_CONTROL: { CRITICAL: 8, HIGH: 24, ELEVATED: 72, ROUTINE: 168 },
    GENERAL_MONITORING: { CRITICAL: 12, HIGH: 24, ELEVATED: 96, ROUTINE: 168 },
  };
  return matrix[playbook][priority];
}

function deriveEscalationWorkflow(playbook: HealthEvent["playbook"]): string[] {
  const workflows: Record<HealthEvent["playbook"], string[]> = {
    PANDEMIC_RESPIRATORY: [
      "Rapid respiratory threat briefing to BAG leadership.",
      "Activate hospital and laboratory surge readiness checkpoints.",
      "Issue cross-cantonal situational communication plan.",
      "Escalate to federal crisis coordination if transmission indicators rise.",
    ],
    ZOONOTIC_SPILLOVER: [
      "Convene BAG-BLV One Health incident cell.",
      "Trigger animal-human interface investigation and targeted diagnostics.",
      "Align cantonal veterinary/public health control measures.",
      "Escalate federal coordination if spillover or cross-border spread is detected.",
    ],
    FOODBORNE_CONTAINMENT: [
      "Trigger BLV-led food-chain traceback and source attribution.",
      "Coordinate import control and market surveillance checks.",
      "Issue risk communication to food safety and clinical networks.",
      "Escalate federal response if multi-canton exposure is confirmed.",
    ],
    VECTOR_CONTROL: [
      "Initiate enhanced vector and environmental surveillance.",
      "Coordinate cantonal vector control readiness and diagnostics.",
      "Issue traveler and clinician advisories for at-risk areas.",
      "Escalate to interagency activation if local transmission is detected.",
    ],
    GENERAL_MONITORING: [
      "Maintain routine surveillance and source verification.",
      "Review epidemiological indicators at scheduled checkpoints.",
      "Escalate to enhanced monitoring if risk trajectory increases.",
    ],
  };
  return workflows[playbook];
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
  const operationalPriority = event.operational_priority || deriveOperationalPriority(event);
  const imsActivation = event.ims_activation || deriveIMSActivation(operationalPriority);
  const leadAgency = event.lead_agency || deriveLeadAgency(event);
  const hazardClass = event.hazard_class || deriveHazardClass(event);
  const playbook = event.playbook || derivePlaybook(hazardClass);
  const escalationLevel = event.escalation_level || deriveEscalationLevel(operationalPriority);
  const playbookSLA = event.playbook_sla_hours ?? derivePlaybookSLA(playbook, operationalPriority);
  const escalationWorkflow = event.escalation_workflow || deriveEscalationWorkflow(playbook);
  const decisionWindow =
    event.decision_window_hours ?? (
      operationalPriority === "CRITICAL" ? 6 : operationalPriority === "HIGH" ? 24 : operationalPriority === "ELEVATED" ? 72 : 168
    );

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
