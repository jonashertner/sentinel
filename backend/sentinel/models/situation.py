import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from .annotation import Annotation


class SituationStatus(StrEnum):
    ACTIVE = "ACTIVE"
    WATCH = "WATCH"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    ARCHIVED = "ARCHIVED"


class Priority(StrEnum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class Situation(BaseModel):
    id: str = Field(default_factory=lambda: f"sit-{uuid.uuid4().hex[:8]}")
    title: str
    status: SituationStatus = SituationStatus.ACTIVE
    created: date = Field(default_factory=lambda: date.today())
    updated: datetime = Field(default_factory=lambda: datetime.now(UTC))
    events: list[str] = Field(default_factory=list)
    diseases: list[str]
    countries: list[str]
    lead_analyst: str
    priority: Priority = Priority.P2
    summary: str
    annotations: list[Annotation] = Field(default_factory=list)
    swiss_impact_assessment: str = ""
    recommended_actions: list[str] = Field(default_factory=list)
    human_health_status: str | None = None
    animal_health_status: str | None = None
    environmental_status: str | None = None
