import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

WHO_DON_FEED = "https://www.who.int/feeds/entity/don/en/rss.xml"


class WHODONCollector(BaseCollector):
    source_name = "WHO_DON"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(WHO_DON_FEED)
                resp.raise_for_status()
            return self.parse_feed(resp.text)
        except Exception:
            logger.exception("Failed to collect WHO DON feed")
            return []

    def parse_feed(self, xml: str) -> list[HealthEvent]:
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
        published = entry.get("published_parsed")

        if not title or not link:
            return None

        date_reported = (
            date(published.tm_year, published.tm_mon, published.tm_mday)
            if published
            else date.today()
        )

        disease, countries = self._extract_disease_and_countries(title)

        return HealthEvent(
            source=Source.WHO_DON,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=countries,
            regions=[],
            species=Species.HUMAN,
            summary=summary[:2000],
            url=link,
            raw_content=summary,
        )

    def _extract_disease_and_countries(self, title: str) -> tuple[str, list[str]]:
        parts = re.split(r"\s*[–—-]\s*", title, maxsplit=1)
        disease = parts[0].strip() if parts else title
        countries = []
        if len(parts) > 1:
            countries = [parts[1].strip()[:2].upper()]
        return disease, countries if countries else ["XX"]
