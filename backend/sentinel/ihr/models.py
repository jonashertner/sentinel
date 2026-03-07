"""IHR (International Health Regulations) notification workflow models.

Implements the IHR 2005 Annex 2 decision instrument for assessing whether
an event constitutes a potential PHEIC and requires WHO notification.
Switzerland must notify WHO within 24 hours of assessment.
"""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class IHRStatus(StrEnum):
    FLAGGED = "FLAGGED"          # Auto-flagged by system
    ASSESSING = "ASSESSING"      # Analyst reviewing Annex 2 criteria
    DRAFT = "DRAFT"              # Notification draft prepared
    APPROVED = "APPROVED"        # Supervisor approved
    NOTIFIED = "NOTIFIED"        # Sent to WHO
    ACKNOWLEDGED = "ACKNOWLEDGED"  # WHO acknowledged receipt
    FOLLOW_UP = "FOLLOW_UP"      # Ongoing follow-up required
    CLOSED = "CLOSED"            # Assessment closed (no notification needed or completed)


class Annex2Assessment(BaseModel):
    """Structured IHR Annex 2 decision instrument assessment."""
    # Box 1: Is the event unusual or unexpected?
    unusual: bool | None = None
    unusual_rationale: str = ""

    # Box 2: Is there a significant risk of international spread?
    international_spread: bool | None = None
    international_spread_rationale: str = ""

    # Box 3: Is there a significant risk of international trade/travel restrictions?
    trade_travel_risk: bool | None = None
    trade_travel_risk_rationale: str = ""

    # Box 4: Is there a risk of serious public health impact?
    serious_impact: bool | None = None
    serious_impact_rationale: str = ""

    @property
    def requires_notification(self) -> bool:
        """IHR Annex 2: any two 'yes' answers → notify."""
        answers = [self.unusual, self.international_spread,
                   self.trade_travel_risk, self.serious_impact]
        return sum(1 for a in answers if a) >= 2


class IHRNotification(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    event_ids: list[str]
    status: IHRStatus = IHRStatus.FLAGGED
    assessor: str = ""
    assessment: Annex2Assessment = Field(default_factory=Annex2Assessment)
    draft_notification: str = ""
    notified_at: datetime | None = None
    who_reference: str = ""
    who_response: str = ""
    deadline: datetime | None = None
    notes: list[str] = Field(default_factory=list)
    created: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated: datetime = Field(default_factory=lambda: datetime.now(UTC))
