import hashlib
import json
from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field, computed_field, model_validator


class Source(StrEnum):
    WHO_DON = "WHO_DON"
    WHO_EIOS = "WHO_EIOS"
    PROMED = "PROMED"
    ECDC = "ECDC"
    WOAH = "WOAH"
    BEACON = "BEACON"
    CIDRAP = "CIDRAP"
    NNSID = "NNSID"
    SENTINELLA = "SENTINELLA"
    BAG_BULLETIN = "BAG_BULLETIN"
    RASFF = "RASFF"
    WASTEWATER = "WASTEWATER"


class Species(StrEnum):
    HUMAN = "human"
    ANIMAL = "animal"
    BOTH = "both"


class VerificationStatus(StrEnum):
    UNVERIFIED = "UNVERIFIED"
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REFUTED = "REFUTED"


class RiskCategory(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class OperationalPriority(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    ELEVATED = "ELEVATED"
    ROUTINE = "ROUTINE"


class IMSActivation(StrEnum):
    FULL_ACTIVATION = "FULL_ACTIVATION"
    PARTIAL_ACTIVATION = "PARTIAL_ACTIVATION"
    ENHANCED_MONITORING = "ENHANCED_MONITORING"
    MONITORING = "MONITORING"


class LeadAgency(StrEnum):
    BAG = "BAG"
    BLV = "BLV"
    JOINT = "JOINT"


class HazardClass(StrEnum):
    PANDEMIC_RESPIRATORY = "PANDEMIC_RESPIRATORY"
    ZOONOTIC_SPILLOVER = "ZOONOTIC_SPILLOVER"
    FOODBORNE = "FOODBORNE"
    VECTOR_BORNE = "VECTOR_BORNE"
    GENERAL = "GENERAL"


class PlaybookType(StrEnum):
    PANDEMIC_RESPIRATORY = "PANDEMIC_RESPIRATORY"
    ZOONOTIC_SPILLOVER = "ZOONOTIC_SPILLOVER"
    FOODBORNE_CONTAINMENT = "FOODBORNE_CONTAINMENT"
    VECTOR_CONTROL = "VECTOR_CONTROL"
    GENERAL_MONITORING = "GENERAL_MONITORING"


class EscalationLevel(StrEnum):
    ROUTINE_SURVEILLANCE = "ROUTINE_SURVEILLANCE"
    INTERAGENCY_COORDINATION = "INTERAGENCY_COORDINATION"
    FEDERAL_ESCALATION = "FEDERAL_ESCALATION"
    NATIONAL_CRISIS = "NATIONAL_CRISIS"


def _compute_risk_category(score: float) -> RiskCategory:
    if score >= 8.0:
        return RiskCategory.CRITICAL
    if score >= 6.0:
        return RiskCategory.HIGH
    if score >= 4.0:
        return RiskCategory.MEDIUM
    return RiskCategory.LOW


def _source_base_confidence(source: Source) -> float:
    if source in (Source.WHO_DON, Source.ECDC):
        return 0.95
    if source == Source.WOAH:
        return 0.90
    if source == Source.PROMED:
        return 0.75
    if source == Source.CIDRAP:
        return 0.80
    if source == Source.BEACON:
        return 0.70
    if source == Source.WHO_EIOS:
        return 0.60
    return 0.60


class SourceEvidence(BaseModel):
    source: Source
    event_id: str
    url: str
    title: str
    date_reported: date
    confidence: float = Field(ge=0.0, le=1.0)


class AnalystOverride(BaseModel):
    annotation_id: str
    author: str
    timestamp: datetime
    fields: list[str] = Field(default_factory=list)
    note: str = ""


class HealthEvent(BaseModel):
    id: str = ""
    source: Source
    title: str
    date_reported: date
    date_collected: date
    disease: str
    pathogen: str | None = None
    countries: list[str]
    regions: list[str]
    species: Species
    case_count: int | None = None
    death_count: int | None = None
    summary: str
    url: str
    raw_content: str

    risk_score: float = Field(default=0.0, ge=0.0, le=10.0)
    swiss_relevance: float = Field(default=0.0, ge=0.0, le=10.0)
    one_health_tags: list[str] = Field(default_factory=list)
    analysis: str = ""

    verification_status: VerificationStatus = VerificationStatus.UNVERIFIED

    # IHR (2005) Annex 2 decision instrument criteria
    ihr_unusual: bool | None = None
    ihr_serious_impact: bool | None = None
    ihr_international_spread: bool | None = None
    ihr_trade_travel_risk: bool | None = None

    # Executive decision-support fields (Swiss federal operations view)
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)
    probability_score: float = Field(default=0.0, ge=0.0, le=5.0)
    impact_score: float = Field(default=0.0, ge=0.0, le=5.0)
    operational_priority: OperationalPriority = OperationalPriority.ROUTINE
    ims_activation: IMSActivation = IMSActivation.MONITORING
    lead_agency: LeadAgency = LeadAgency.JOINT
    decision_window_hours: int = Field(default=168, ge=1, le=720)
    trigger_flags: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)

    # Immutable source provenance graph metadata
    merged_from: list[str] = Field(default_factory=list)
    source_evidence: list[SourceEvidence] = Field(default_factory=list)
    provenance_hash: str = ""
    analyst_overrides: list[AnalystOverride] = Field(default_factory=list)

    # Decision playbook and SLA/escalation workflow
    hazard_class: HazardClass = HazardClass.GENERAL
    playbook: PlaybookType = PlaybookType.GENERAL_MONITORING
    playbook_sla_hours: int = Field(default=168, ge=1, le=720)
    sla_timer_hours: int = Field(default=168, ge=0, le=720)
    escalation_level: EscalationLevel = EscalationLevel.ROUTINE_SURVEILLANCE
    escalation_workflow: list[str] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def risk_category(self) -> RiskCategory:
        return _compute_risk_category(self.risk_score)

    @model_validator(mode="after")
    def _set_computed_fields(self):
        if not self.id:
            countries = "|".join(sorted(self.countries))
            raw = f"{self.disease}|{countries}|{self.date_reported}|{self.source}"
            self.id = hashlib.sha256(raw.encode()).hexdigest()[:16]

        if not self.merged_from:
            self.merged_from = [self.id]
        else:
            self.merged_from = sorted(set(self.merged_from + [self.id]))

        if not self.source_evidence:
            self.source_evidence = [
                SourceEvidence(
                    source=self.source,
                    event_id=self.id,
                    url=self.url,
                    title=self.title,
                    date_reported=self.date_reported,
                    confidence=_source_base_confidence(self.source),
                )
            ]

        if self.sla_timer_hours == 168 and self.playbook_sla_hours != 168:
            # Keep timer aligned to playbook SLA unless already explicitly set.
            self.sla_timer_hours = self.playbook_sla_hours

        normalized_evidence = sorted(
            (
                {
                    "source": e.source.value,
                    "event_id": e.event_id,
                    "url": e.url,
                    "title": e.title,
                    "date_reported": e.date_reported.isoformat(),
                    "confidence": e.confidence,
                }
                for e in self.source_evidence
            ),
            key=lambda item: (item["source"], item["event_id"], item["url"]),
        )
        raw_graph = json.dumps(
            {"merged_from": sorted(self.merged_from), "evidence": normalized_evidence},
            sort_keys=True,
        )
        self.provenance_hash = hashlib.sha256(raw_graph.encode()).hexdigest()[:20]
        return self
