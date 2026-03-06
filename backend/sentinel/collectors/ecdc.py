import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

ECDC_FEED = "https://www.ecdc.europa.eu/en/taxonomy/term/2942/feed"


class ECDCCollector(BaseCollector):
    source_name = "ECDC"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(ECDC_FEED)
                resp.raise_for_status()
            return self.parse_feed(resp.text)
        except Exception:
            logger.exception("Failed to collect ECDC feed")
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
            source=Source.ECDC,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=countries,
            regions=["EURO"],
            species=Species.HUMAN,
            summary=summary[:2000],
            url=link,
            raw_content=summary,
        )

    def _extract_disease_and_countries(self, title: str) -> tuple[str, list[str]]:
        # ECDC titles: "Report name, date range, week N" or "Disease - Country"
        parts = re.split(r"\s*[–—]\s*", title, maxsplit=1)
        disease = parts[0].strip() if parts else title

        # Remove trailing date/week info from disease name
        disease = re.sub(r",\s*\d{1,2}\s+\w+\s*$", "", disease)
        disease = re.sub(r",\s*week\s+\d+\s*$", "", disease, flags=re.IGNORECASE)

        countries: list[str] = []
        if len(parts) > 1:
            location = parts[1].strip()
            location_clean = re.sub(r",?\s*week\s+\d+.*$", "", location, flags=re.IGNORECASE).strip()
            if location_clean and len(location_clean) >= 2:
                countries = [location_clean[:2].upper()]
        return disease, countries if countries else ["EU"]
