import uuid
from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from sentinel.models.event import (
    EscalationLevel,
    OperationalPriority,
    PlaybookType,
    VerificationStatus,
)


class AnnotationType(StrEnum):
    ASSESSMENT = "ASSESSMENT"
    NOTE = "NOTE"
    ACTION = "ACTION"
    LINK = "LINK"
    ESCALATION = "ESCALATION"


class EventStatus(StrEnum):
    NEW = "NEW"
    MONITORING = "MONITORING"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    ARCHIVED = "ARCHIVED"


class Visibility(StrEnum):
    INTERNAL = "INTERNAL"
    SHARED = "SHARED"
    CONFIDENTIAL = "CONFIDENTIAL"


class Annotation(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    event_id: str
    author: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    type: AnnotationType
    content: str
    visibility: Visibility
    risk_override: float | None = Field(default=None, ge=0.0, le=10.0)
    status_change: EventStatus | None = None
    linked_event_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    verification_override: VerificationStatus | None = None
    operational_priority_override: OperationalPriority | None = None
    playbook_override: PlaybookType | None = None
    playbook_sla_override_hours: int | None = Field(default=None, ge=1, le=720)
    escalation_level_override: EscalationLevel | None = None
    override_reason: str = ""
