import hashlib
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


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
    risk_category: RiskCategory = RiskCategory.LOW
    one_health_tags: list[str] = Field(default_factory=list)
    analysis: str = ""

    @model_validator(mode="after")
    def _set_computed_fields(self):
        if not self.id:
            countries = "|".join(sorted(self.countries))
            raw = f"{self.disease}|{countries}|{self.date_reported}|{self.source}"
            self.id = hashlib.sha256(raw.encode()).hexdigest()[:16]
        self.risk_category = _compute_risk_category(self.risk_score)
        return self
