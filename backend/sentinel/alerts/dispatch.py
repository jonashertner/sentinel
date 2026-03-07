"""Notification dispatch — sends matched alerts via configured channels."""

import logging

from sentinel.alerts.models import AlertChannel, AlertMatch
from sentinel.ws import manager

logger = logging.getLogger(__name__)


async def dispatch_matches(matches: list[AlertMatch]) -> None:
    """Dispatch alert matches to their configured channels."""
    for match in matches:
        for channel in match.channels:
            try:
                await _dispatch_one(channel, match)
            except Exception:
                logger.exception(
                    "Failed to dispatch alert %s via %s", match.id, channel
                )


async def _dispatch_one(channel: AlertChannel, match: AlertMatch) -> None:
    match channel:
        case AlertChannel.IN_APP:
            await _dispatch_in_app(match)
        case AlertChannel.EMAIL:
            _dispatch_email(match)
        case AlertChannel.WEBHOOK:
            _dispatch_webhook(match)


async def _dispatch_in_app(match: AlertMatch) -> None:
    """Broadcast alert via WebSocket to all connected clients."""
    await manager.broadcast("alert", match.model_dump(mode="json"))
    logger.info("In-app alert dispatched: %s → %s", match.rule_name, match.event_title)


def _dispatch_email(match: AlertMatch) -> None:
    """Placeholder for email dispatch (requires SMTP config)."""
    logger.info("Email alert (stub): %s → %s", match.rule_name, match.event_title)


def _dispatch_webhook(match: AlertMatch) -> None:
    """Placeholder for webhook dispatch (requires webhook URL config)."""
    logger.info("Webhook alert (stub): %s → %s", match.rule_name, match.event_title)
