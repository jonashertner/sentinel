import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

PROMED_FEED = "https://promedmail.org/feed/"


class ProMEDCollector(BaseCollector):
    source_name = "PROMED"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(PROMED_FEED)
                resp.raise_for_status()
            return self.parse_feed(resp.text)
        except Exception:
            logger.exception("Failed to collect ProMED feed")
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

        species = self._detect_species(title)
        disease, countries = self._extract_disease_and_countries(title)

        return HealthEvent(
            source=Source.PROMED,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=countries,
            regions=[],
            species=species,
            summary=summary[:2000],
            url=link,
            raw_content=summary,
        )

    def _detect_species(self, title: str) -> Species:
        """Detect species from ProMED subject line prefix.

        PRO/ = human, AH/ = animal health, EDR = emerging disease.
        """
        upper = title.upper()
        if "PRO/AH/" in upper or "AH/" in upper:
            return Species.ANIMAL
        return Species.HUMAN

    def _extract_disease_and_countries(self, title: str) -> tuple[str, list[str]]:
        """Parse ProMED subject: 'PRO/AH/EDR> Disease - Country: details'."""
        # Strip the prefix (e.g. "PRO/AH/EDR> ")
        cleaned = re.sub(r"^PRO(/[A-Z]+)*>\s*", "", title, flags=re.IGNORECASE)

        # Split on " - " to get disease and location
        parts = re.split(r"\s*-\s*", cleaned, maxsplit=1)
        disease = parts[0].strip() if parts else title
        countries = []
        if len(parts) > 1:
            # Country part may have ": details" after it
            country_part = parts[1].split(":")[0].strip()
            if country_part:
                countries = [country_part[:2].upper()]
        return disease, countries if countries else ["XX"]
