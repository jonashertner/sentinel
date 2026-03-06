"""ECDC Epidemiological Updates collector (replaces WHO EIOS for PoC).

WHO EIOS requires institutional access credentials. This collector uses
the ECDC publications/data feed which contains epidemiological updates,
rapid risk assessments, and surveillance reports.
"""

import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

# ECDC epidemiological publications and data feed
ECDC_EPID_FEED = "https://www.ecdc.europa.eu/en/taxonomy/term/2943/feed"


class WHOEIOSCollector(BaseCollector):
    """Collects ECDC epidemiological updates as supplementary European intelligence."""

    source_name = "WHO_EIOS"

    def __init__(self, api_url: str = ECDC_EPID_FEED):
        self.api_url = api_url

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "SENTINEL/1.0"}) as client:
                resp = await client.get(self.api_url)
                resp.raise_for_status()
            return self._parse_feed(resp.text)
        except Exception:
            logger.exception("Failed to collect ECDC epidemiological data")
            return []

    def _parse_feed(self, xml: str) -> list[HealthEvent]:
        feed = feedparser.parse(xml)
        events = []
        for entry in feed.entries:
            event = self._parse_entry(entry)
            if event:
                events.append(event)
        return events

    def _parse_entry(self, entry) -> HealthEvent | None:
        title = entry.get("title", "")
        link = entry.get("link", "")
        summary = entry.get("summary", "")

        if not title or not link:
            return None

        # Strip HTML
        clean_summary = re.sub(r"<[^>]+>", " ", summary).strip()

        published = entry.get("published_parsed")
        date_reported = (
            date(published.tm_year, published.tm_mon, published.tm_mday)
            if published
            else date.today()
        )

        disease = self._extract_disease(title)

        return HealthEvent(
            source=Source.WHO_EIOS,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=["EU"],
            regions=["EURO"],
            species=Species.HUMAN,
            summary=clean_summary[:2000],
            url=link,
            raw_content=clean_summary,
        )

    def _extract_disease(self, title: str) -> str:
        parts = re.split(r"\s*[–—,]\s*", title, maxsplit=1)
        return parts[0].strip() if parts else title
