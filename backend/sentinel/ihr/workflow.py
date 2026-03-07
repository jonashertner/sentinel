"""IHR notification workflow logic."""

import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sentinel.config import settings
from sentinel.ihr.models import Annex2Assessment, IHRNotification, IHRStatus
from sentinel.models.event import HealthEvent

logger = logging.getLogger(__name__)

# IHR requires notification within 24 hours of assessment start
IHR_DEADLINE_HOURS = 24
# Alert 4 hours before deadline
IHR_WARNING_HOURS = 20


def auto_flag_events(events: list[HealthEvent]) -> list[HealthEvent]:
    """Flag events that may require IHR notification based on automated IHR assessment."""
    flagged = []
    for event in events:
        if _should_flag(event):
            flagged.append(event)
    return flagged


def _should_flag(event: HealthEvent) -> bool:
    """Check if event meets automated IHR flagging criteria."""
    score = 0
    if event.ihr_unusual:
        score += 1
    if event.ihr_serious_impact:
        score += 1
    if event.ihr_international_spread:
        score += 1
    if event.ihr_trade_travel_risk:
        score += 1
    # Also flag high-risk events with international dimensions
    if event.risk_score >= 8.0 and len(event.countries) > 1:
        score += 1
    return score >= 2


def start_assessment(
    event_ids: list[str], assessor: str
) -> IHRNotification:
    """Start an IHR assessment for one or more events."""
    notification = IHRNotification(
        event_ids=event_ids,
        status=IHRStatus.ASSESSING,
        assessor=assessor,
        deadline=datetime.now(UTC) + timedelta(hours=IHR_DEADLINE_HOURS),
    )
    notifications = load_notifications()
    notifications.append(notification)
    save_notifications(notifications)
    logger.info("IHR assessment started: %s by %s", notification.id, assessor)
    return notification


def update_assessment(
    notification_id: str, assessment: Annex2Assessment
) -> IHRNotification:
    """Update the Annex 2 assessment for a notification."""
    notifications = load_notifications()
    for n in notifications:
        if n.id == notification_id:
            n.assessment = assessment
            n.updated = datetime.now(UTC)
            if assessment.requires_notification:
                n.status = IHRStatus.DRAFT
            else:
                n.status = IHRStatus.CLOSED
                n.notes.append("Assessment: notification not required")
            save_notifications(notifications)
            return n
    raise ValueError(f"Notification {notification_id} not found")


def get_overdue_notifications() -> list[IHRNotification]:
    """Find notifications approaching or past their 24h deadline."""
    notifications = load_notifications()
    now = datetime.now(UTC)
    overdue = []
    for n in notifications:
        if n.status in (IHRStatus.ASSESSING, IHRStatus.DRAFT, IHRStatus.APPROVED):
            if n.deadline and n.deadline < now:
                overdue.append(n)
    return overdue


def get_dashboard_summary() -> dict:
    """Summary for IHR dashboard."""
    notifications = load_notifications()
    now = datetime.now(UTC)
    return {
        "total": len(notifications),
        "pending": sum(
            1 for n in notifications
            if n.status in (IHRStatus.FLAGGED, IHRStatus.ASSESSING)
        ),
        "draft": sum(1 for n in notifications if n.status == IHRStatus.DRAFT),
        "notified": sum(1 for n in notifications if n.status == IHRStatus.NOTIFIED),
        "overdue": sum(
            1 for n in notifications
            if n.status in (IHRStatus.ASSESSING, IHRStatus.DRAFT)
            and n.deadline
            and n.deadline < now
        ),
        "closed": sum(1 for n in notifications if n.status == IHRStatus.CLOSED),
    }


# -- File-based persistence --


def _notifications_path() -> Path:
    p = Path(settings.data_dir) / "ihr_notifications.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def load_notifications() -> list[IHRNotification]:
    path = _notifications_path()
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    return [IHRNotification.model_validate(n) for n in data]


def save_notifications(notifications: list[IHRNotification]) -> None:
    path = _notifications_path()
    path.write_text(
        json.dumps(
            [n.model_dump(mode="json") for n in notifications], indent=2
        )
    )
