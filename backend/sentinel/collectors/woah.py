"""WOAH (World Organisation for Animal Health) collector.

The WAHIS API is behind Cloudflare protection and requires authenticated access.
This collector uses the public WOAH RSS news feed and filters for disease-related
content (immediate notifications, situation reports, disease statements).
"""

import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

WOAH_RSS = "https://www.woah.org/en/feed/"

# Specific disease/outbreak keywords — strict to avoid policy noise
DISEASE_KEYWORDS = [
    "influenza", "avian", "h5n1", "h5n5", "h5n8", "hpai",
    "foot-and-mouth", "fmd", "african swine fever", "asf",
    "bluetongue", "btv", "rift valley", "anthrax", "rabies",
    "brucella", "brucellosis", "newcastle disease",
    "lumpy skin", "peste des petits", "rinderpest",
    "west nile", "outbreak", "epizootic",
    "notification", "immediate notification",
    "antimicrobial resistance",
]


class WOAHCollector(BaseCollector):
    source_name = "WOAH"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "SENTINEL/1.0"}) as client:
                resp = await client.get(WOAH_RSS)
                resp.raise_for_status()
            return self._parse_feed(resp.text)
        except Exception:
            logger.exception("Failed to collect WOAH feed")
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

        if not title:
            return None

        # Filter: only disease/animal health relevant items
        text = f"{title} {summary}".lower()
        if not any(kw in text for kw in DISEASE_KEYWORDS):
            return None

        published = entry.get("published_parsed")
        date_reported = (
            date(published.tm_year, published.tm_mon, published.tm_mday)
            if published
            else date.today()
        )

        # Strip HTML from summary
        clean_summary = re.sub(r"<[^>]+>", " ", summary).strip()

        disease = self._extract_disease(title, clean_summary)

        return HealthEvent(
            source=Source.WOAH,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=["XX"],  # WOAH news typically covers multiple countries
            regions=[],
            species=Species.ANIMAL,
            summary=clean_summary[:2000],
            url=link,
            raw_content=clean_summary,
        )

    def _extract_disease(self, title: str, summary: str) -> str:
        text = f"{title} {summary}".lower()
        disease_map = {
            "avian influenza": "Avian influenza",
            "h5n1": "Avian influenza A(H5N1)",
            "hpai": "Highly pathogenic avian influenza",
            "african swine fever": "African swine fever",
            "foot-and-mouth": "Foot-and-mouth disease",
            "bluetongue": "Bluetongue",
            "rift valley": "Rift Valley fever",
            "lumpy skin": "Lumpy skin disease",
            "peste des petits": "Peste des petits ruminants",
            "west nile": "West Nile virus",
            "rabies": "Rabies",
            "anthrax": "Anthrax",
            "brucell": "Brucellosis",
            "newcastle": "Newcastle disease",
        }
        for keyword, disease_name in disease_map.items():
            if keyword in text:
                return disease_name
        return title[:100]
