/* -----------------------------------------------------------------------
 * SENTINEL — TypeScript interfaces mirroring backend Pydantic models.
 * Source of truth: backend/sentinel/models/
 * ----------------------------------------------------------------------- */

// --- Enums ---

export type Source = "WHO_DON" | "WHO_EIOS" | "PROMED" | "ECDC" | "WOAH" | "BEACON" | "CIDRAP";

export type Species = "human" | "animal" | "both";

export type RiskCategory = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type VerificationStatus = "UNVERIFIED" | "PENDING" | "CONFIRMED" | "REFUTED";

export type OperationalPriority = "CRITICAL" | "HIGH" | "ELEVATED" | "ROUTINE";

export type IMSActivation =
  | "FULL_ACTIVATION"
  | "PARTIAL_ACTIVATION"
  | "ENHANCED_MONITORING"
  | "MONITORING";

export type LeadAgency = "BAG" | "BLV" | "JOINT";

export type HazardClass =
  | "PANDEMIC_RESPIRATORY"
  | "ZOONOTIC_SPILLOVER"
  | "FOODBORNE"
  | "VECTOR_BORNE"
  | "GENERAL";

export type PlaybookType =
  | "PANDEMIC_RESPIRATORY"
  | "ZOONOTIC_SPILLOVER"
  | "FOODBORNE_CONTAINMENT"
  | "VECTOR_CONTROL"
  | "GENERAL_MONITORING";

export type EscalationLevel =
  | "ROUTINE_SURVEILLANCE"
  | "INTERAGENCY_COORDINATION"
  | "FEDERAL_ESCALATION"
  | "NATIONAL_CRISIS";

export type AnnotationType =
  | "ASSESSMENT"
  | "NOTE"
  | "ACTION"
  | "LINK"
  | "ESCALATION";

export type EventStatus =
  | "NEW"
  | "MONITORING"
  | "ESCALATED"
  | "RESOLVED"
  | "ARCHIVED";

export type Visibility = "INTERNAL" | "SHARED" | "CONFIDENTIAL";

export type SituationStatus =
  | "ACTIVE"
  | "WATCH"
  | "ESCALATED"
  | "RESOLVED"
  | "ARCHIVED";

export type Priority = "P1" | "P2" | "P3" | "P4";

// --- Models ---

export interface HealthEvent {
  id: string;
  source: Source;
  title: string;
  date_reported: string; // ISO date
  date_collected: string; // ISO date
  disease: string;
  pathogen: string | null;
  countries: string[];
  regions: string[];
  species: Species;
  case_count: number | null;
  death_count: number | null;
  summary: string;
  url: string;
  raw_content: string;
  risk_score: number;
  swiss_relevance: number;
  risk_category: RiskCategory;
  one_health_tags: string[];
  analysis: string;
  verification_status: VerificationStatus;
  ihr_unusual: boolean | null;
  ihr_serious_impact: boolean | null;
  ihr_international_spread: boolean | null;
  ihr_trade_travel_risk: boolean | null;
  confidence_score: number;
  probability_score: number;
  impact_score: number;
  operational_priority: OperationalPriority;
  ims_activation: IMSActivation;
  lead_agency: LeadAgency;
  decision_window_hours: number;
  trigger_flags: string[];
  recommended_actions: string[];
  merged_from: string[];
  source_evidence: SourceEvidence[];
  provenance_hash: string;
  analyst_overrides: AnalystOverride[];
  hazard_class: HazardClass;
  playbook: PlaybookType;
  playbook_sla_hours: number;
  sla_timer_hours: number;
  escalation_level: EscalationLevel;
  escalation_workflow: string[];
}

export interface SourceEvidence {
  source: Source;
  event_id: string;
  url: string;
  title: string;
  date_reported: string; // ISO date
  confidence: number;
}

export interface AnalystOverride {
  annotation_id: string;
  author: string;
  timestamp: string; // ISO datetime
  fields: string[];
  note: string;
}

export interface Annotation {
  id: string;
  event_id: string;
  author: string;
  timestamp: string; // ISO datetime
  type: AnnotationType;
  content: string;
  visibility: Visibility;
  risk_override: number | null;
  status_change: EventStatus | null;
  linked_event_ids: string[];
  tags: string[];
  verification_override: VerificationStatus | null;
  operational_priority_override: OperationalPriority | null;
  playbook_override: PlaybookType | null;
  playbook_sla_override_hours: number | null;
  escalation_level_override: EscalationLevel | null;
  override_reason: string;
}

export interface Situation {
  id: string;
  title: string;
  status: SituationStatus;
  created: string; // ISO date
  updated: string; // ISO datetime
  events: string[];
  diseases: string[];
  countries: string[];
  lead_analyst: string;
  priority: Priority;
  summary: string;
  annotations: Annotation[];
  swiss_impact_assessment: string;
  recommended_actions: string[];
  human_health_status: string | null;
  animal_health_status: string | null;
  environmental_status: string | null;
}

export interface Organization {
  id: string;
  name: string;
  domain_focus: string[];
  species_filter: string[];
  priority_sources: string[];
  report_template: string;
}

export interface Watchlist {
  id: string;
  name: string;
  diseases: string[];
  countries: string[];
  min_risk_score: number;
  one_health_tags: string[];
}
