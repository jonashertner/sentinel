"""Alert rule and match models."""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class AlertChannel(StrEnum):
    IN_APP = "in_app"
    EMAIL = "email"
    WEBHOOK = "webhook"


class AlertOperator(StrEnum):
    GTE = "gte"
    LTE = "lte"
    EQ = "eq"
    NEQ = "neq"
    IN = "in"
    CONTAINS = "contains"


class AlertCondition(BaseModel):
    field: str  # e.g. "risk_score", "disease", "countries", "operational_priority"
    operator: AlertOperator
    value: str | float | list[str]


class AlertRule(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str
    conditions: list[AlertCondition]
    channels: list[AlertChannel] = Field(default_factory=lambda: [AlertChannel.IN_APP])
    active: bool = True
    cooldown_minutes: int = Field(default=60, ge=1, le=1440)
    created: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AlertMatch(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    rule_id: str
    rule_name: str
    event_id: str
    event_title: str
    matched_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    channels: list[AlertChannel]
    read: bool = False
