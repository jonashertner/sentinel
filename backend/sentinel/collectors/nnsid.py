"""Collector for Switzerland's National Notification System for Infectious Diseases (NNSID/MNSIK).

NNSID is the mandatory notification system operated by BAG (Federal Office of Public Health).
Laboratories and physicians must report ~80 notifiable diseases within 24 hours.
"""

import logging
from datetime import date

import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.config import settings
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)


class NNSIDCollector(BaseCollector):
    source_name = "NNSID"

    async def collect(self) -> list[HealthEvent]:
        if not settings.nnsid_api_url or not settings.nnsid_api_key:
            logger.warning("NNSID credentials not configured, skipping")
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                settings.nnsid_api_url,
                headers={"Authorization": f"Bearer {settings.nnsid_api_key}"},
                params={"since": date.today().isoformat()},
            )
            resp.raise_for_status()
            return self.parse_notifications(resp.json())

    def parse_notifications(self, data: list[dict]) -> list[HealthEvent]:
        events = []
        for item in data:
            event = self._parse_item(item)
            if event:
                events.append(event)
        return events

    def _parse_item(self, item: dict) -> HealthEvent | None:
        disease = item.get("disease_name", "")
        if not disease:
            return None

        canton = item.get("canton", "")
        regions = [f"CH-{canton}"] if canton else ["CH"]

        return HealthEvent(
            source=Source.NNSID,
            title=f"NNSID: {disease} notification — {canton or 'CH'}",
            date_reported=date.fromisoformat(item.get("report_date", date.today().isoformat())),
            date_collected=date.today(),
            disease=disease,
            countries=["CH"],
            regions=regions,
            species=Species.HUMAN,
            case_count=item.get("case_count"),
            summary=item.get("summary", ""),
            url=item.get("url", ""),
            raw_content=str(item),
            confidence_score=0.98,
            swiss_relevance=1.0,
        )
