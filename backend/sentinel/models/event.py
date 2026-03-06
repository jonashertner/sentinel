import hashlib
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, computed_field, model_validator


class Source(StrEnum):
    WHO_DON = "WHO_DON"
    WHO_EIOS = "WHO_EIOS"
    PROMED = "PROMED"
    ECDC = "ECDC"
    WOAH = "WOAH"


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


def _compute_risk_category(score: float) -> RiskCategory:
    if score >= 8.0:
        return RiskCategory.CRITICAL
    if score >= 6.0:
        return RiskCategory.HIGH
    if score >= 4.0:
        return RiskCategory.MEDIUM
    return RiskCategory.LOW


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
        return self
