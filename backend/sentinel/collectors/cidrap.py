import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.analysis.normalizer import normalize_country
from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

CIDRAP_FEED = "https://www.cidrap.umn.edu/feed/news.xml"


class CIDRAPCollector(BaseCollector):
    source_name = "CIDRAP"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "SENTINEL/1.0"},
            ) as client:
                resp = await client.get(CIDRAP_FEED)
                resp.raise_for_status()
            return self.parse_feed(resp.text)
        except Exception:
            logger.exception("Failed to collect CIDRAP feed")
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

        disease = self._extract_disease(title)
        countries = self._extract_countries(title, summary)
        species = self._detect_species(title)

        return HealthEvent(
            source=Source.CIDRAP,
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

    def _extract_disease(self, title: str) -> str:
        """Extract disease name from CIDRAP headline."""
        known = [
            "H5N1", "H5N6", "H7N9", "avian flu", "bird flu",
            "mpox", "Ebola", "Marburg", "Nipah", "MERS", "COVID",
            "dengue", "cholera", "measles", "polio", "plague",
            "Zika", "chikungunya", "West Nile", "Rift Valley fever",
            "Lassa", "influenza", "RSV", "tuberculosis",
        ]
        lower = title.lower()
        for d in known:
            if d.lower() in lower:
                return d
        return title.split(":")[0].strip()[:80]

    def _extract_countries(self, title: str, summary: str) -> list[str]:
        """Extract country codes from title and summary."""
        countries: list[str] = []
        text = f"{title} {summary}"
        for token in re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text):
            codes = normalize_country(token)
            for c in codes:
                if c != "XX" and c not in countries:
                    countries.append(c)
            if len(countries) >= 5:
                break
        return countries if countries else ["XX"]

    def _detect_species(self, title: str) -> Species:
        lower = title.lower()
        if "avian" in lower or "bird" in lower or "animal" in lower:
            return Species.ANIMAL
        if "zoonotic" in lower:
            return Species.BOTH
        return Species.HUMAN
