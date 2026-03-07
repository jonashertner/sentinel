import logging
import re
from datetime import date, datetime

import feedparser
import httpx

from sentinel.analysis.normalizer import normalize_country
from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

BEACON_FEED = "https://beacon.healthmap.org/feed/"
HEALTHMAP_ALERTS_URL = "https://www.healthmap.org/getAlerts.php"


class BeaconCollector(BaseCollector):
    source_name = "BEACON"

    async def collect(self) -> list[HealthEvent]:
        async with httpx.AsyncClient(
            timeout=30,
            headers={"User-Agent": "SENTINEL/1.0"},
        ) as client:
            # Legacy Beacon host is frequently unavailable; use HealthMap alerts API.
            resp = await client.get(HEALTHMAP_ALERTS_URL)
            resp.raise_for_status()
        return self.parse_alerts_response(resp.json())

    def parse_alerts_response(self, data: dict | list) -> list[HealthEvent]:
        markers = data if isinstance(data, list) else data.get("markers", [])
        events: list[HealthEvent] = []
        for marker in markers:
            event = self._parse_marker(marker)
            if event:
                events.append(event)
        return events[:120]

    def _parse_marker(self, marker: dict) -> HealthEvent | None:
        disease = str(marker.get("label", "")).strip()
        place = str(marker.get("place_name", "")).strip()
        html = str(marker.get("html", "")).strip()
        if not disease and not place:
            return None

        title = f"{disease} - {place}" if disease and place else disease or place
        countries = [code for code in normalize_country(place) if code != "XX"] if place else []
        if not countries:
            countries = self._extract_countries_from_html(html)
        if not countries:
            countries = ["XX"]

        date_reported = self._extract_date_from_html(html)
        summary = re.sub(r"<[^>]+>", " ", html)
        summary = re.sub(r"\s+", " ", summary).strip()
        if not summary:
            summary = title

        place_id = marker.get("place_id")
        url = "https://www.healthmap.org/en/"
        if place_id is not None:
            url = f"{url}?loc={place_id}"

        species = self._detect_species(title, summary)

        return HealthEvent(
            source=Source.BEACON,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease or "Unknown",
            countries=countries,
            regions=[],
            species=species,
            summary=summary[:2000],
            url=url,
            raw_content=html or summary,
        )

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

    def _extract_date_from_html(self, html: str) -> date:
        match = re.search(r"(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})", html)
        if match:
            try:
                return datetime.strptime(match.group(1), "%d %b %Y").date()
            except (ValueError, TypeError):
                pass
        return date.today()

    def _extract_countries_from_html(self, html: str) -> list[str]:
        countries: list[str] = []
        text = re.sub(r"<[^>]+>", " ", html)
        for token in re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text):
            for code in normalize_country(token):
                if code != "XX" and code not in countries:
                    countries.append(code)
            if len(countries) >= 5:
                break
        return countries
