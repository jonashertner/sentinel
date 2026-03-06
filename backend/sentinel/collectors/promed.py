import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.analysis.normalizer import normalize_country
from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

PROMED_FEED = "https://promedmail.org/feed/"


class ProMEDCollector(BaseCollector):
    source_name = "PROMED"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "SENTINEL/1.0"},
            ) as client:
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
        """Detect species from ProMED subject line prefix."""
        upper = title.upper()
        if "PRO/AH/" in upper or upper.startswith("PRO/AH>") or " AH/" in upper:
            return Species.ANIMAL
        return Species.HUMAN

    def _extract_disease_and_countries(self, title: str) -> tuple[str, list[str]]:
        """Parse ProMED subject lines with variable formatting."""
        cleaned = re.sub(r"^PRO(/[A-Z]+)*>\s*", "", title, flags=re.IGNORECASE).strip()

        # Disease is typically before ":"; remove numeric incident suffix "(57)".
        disease_part = cleaned.split(":", 1)[0].strip()
        disease = re.sub(r"\s*\(\d+\)\s*$", "", disease_part).strip() or cleaned

        countries: list[str] = []
        detail = cleaned.split(":", 1)[1].strip() if ":" in cleaned else ""

        # Prefer explicit parenthetical locations, e.g. "(USA)", "(India)".
        for token in re.findall(r"\(([^)]+)\)", detail):
            for code in normalize_country(token.strip()):
                if code != "XX":
                    countries.append(code)

        # Fallback for dash-style subjects: "Disease - Country: details".
        if not countries and " - " in cleaned:
            location = cleaned.split(" - ", 1)[1].split(":", 1)[0].strip()
            for code in normalize_country(location):
                if code != "XX":
                    countries.append(code)

        # Regional-only references are retained as EU for downstream handling.
        if not countries and "europe" in detail.lower():
            countries.append("EU")

        return disease, sorted(set(countries)) if countries else ["XX"]
