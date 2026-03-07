"""Collector for Switzerland's Sentinella surveillance network.

Sentinella is a sentinel surveillance system run by ~200 primary care physicians
who report weekly consultations for influenza-like illness (ILI), COVID-19,
acute gastroenteritis, tick-borne encephalitis, pertussis, and other conditions.
"""

import logging
from datetime import date

import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.config import settings
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)


class SentinellaCollector(BaseCollector):
    source_name = "SENTINELLA"

    async def collect(self) -> list[HealthEvent]:
        if not settings.sentinella_api_url:
            logger.warning("Sentinella API URL not configured, skipping")
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                settings.sentinella_api_url,
                params={"format": "json"},
            )
            resp.raise_for_status()
            return self.parse_reports(resp.json())

    def parse_reports(self, data: list[dict]) -> list[HealthEvent]:
        events = []
        for item in data:
            event = self._parse_item(item)
            if event:
                events.append(event)
        return events

    def _parse_item(self, item: dict) -> HealthEvent | None:
        disease = item.get("disease", "")
        if not disease:
            return None

        week = item.get("week", "")
        incidence = item.get("incidence_per_100k", 0)
        threshold = item.get("threshold", 0)

        title = f"Sentinella: {disease} week {week}"
        if threshold and incidence > threshold:
            title += f" — ABOVE THRESHOLD ({incidence:.1f}/{threshold:.1f})"

        return HealthEvent(
            source=Source.SENTINELLA,
            title=title,
            date_reported=date.fromisoformat(
                item.get("week_start", date.today().isoformat())
            ),
            date_collected=date.today(),
            disease=disease,
            countries=["CH"],
            regions=["CH"],
            species=Species.HUMAN,
            case_count=item.get("case_count"),
            summary=item.get("summary", f"Incidence: {incidence}/100k"),
            url=item.get("url", ""),
            raw_content=str(item),
            confidence_score=0.85,
            swiss_relevance=1.0,
        )
