/* -----------------------------------------------------------------------
 * SENTINEL — TypeScript interfaces mirroring backend Pydantic models.
 * Source of truth: backend/sentinel/models/
 * ----------------------------------------------------------------------- */

// --- Enums ---

export type Source = "WHO_DON" | "WHO_EIOS" | "PROMED" | "ECDC" | "WOAH";

export type Species = "human" | "animal" | "both";

export type RiskCategory = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

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
