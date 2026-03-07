import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.analysis.normalizer import normalize_country
from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

BEACON_FEED = "https://beacon.healthmap.org/feed/"


class BeaconCollector(BaseCollector):
    source_name = "BEACON"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "SENTINEL/1.0"},
            ) as client:
                resp = await client.get(BEACON_FEED)
                resp.raise_for_status()
            return self.parse_feed(resp.text)
        except Exception:
            logger.exception("Failed to collect Beacon feed")
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
        species = self._detect_species(title, summary)

        return HealthEvent(
            source=Source.BEACON,
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
        """Extract disease from Beacon/HealthMap alert title."""
        known = [
            "H5N1", "H5N6", "H7N9", "avian influenza",
            "mpox", "Ebola", "Marburg", "Nipah", "MERS", "COVID",
            "dengue", "cholera", "measles", "polio", "plague",
            "Zika", "chikungunya", "West Nile", "Rift Valley fever",
            "Lassa", "influenza", "anthrax", "rabies",
        ]
        lower = title.lower()
        for d in known:
            if d.lower() in lower:
                return d
        # Beacon titles often use "Disease - Location" format
        if " - " in title:
            return title.split(" - ")[0].strip()[:80]
        return title.split(":")[0].strip()[:80]

    def _extract_countries(self, title: str, summary: str) -> list[str]:
        """Extract countries from Beacon alert."""
        countries: list[str] = []
        # Beacon often has "Disease - Country" format
        if " - " in title:
            location = title.split(" - ", 1)[1].strip()
            for segment in re.split(r"[,/]|\band\b", location):
                name = segment.strip()
                if name:
                    for code in normalize_country(name):
                        if code != "XX" and code not in countries:
                            countries.append(code)
        if not countries:
            for token in re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", summary):
                codes = normalize_country(token)
                for c in codes:
                    if c != "XX" and c not in countries:
                        countries.append(c)
                if len(countries) >= 5:
                    break
        return countries if countries else ["XX"]

    def _detect_species(self, title: str, summary: str) -> Species:
        text = f"{title} {summary}".lower()
        if "avian" in text or "animal" in text or "livestock" in text:
            return Species.ANIMAL
        if "zoonotic" in text or "spillover" in text:
            return Species.BOTH
        return Species.HUMAN
