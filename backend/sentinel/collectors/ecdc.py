import logging
import re
from datetime import date
from urllib.parse import urlparse

import feedparser
import httpx

from sentinel.analysis.normalizer import normalize_country
from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

ECDC_FEED = "https://www.ecdc.europa.eu/en/taxonomy/term/2942/feed"


class ECDCCollector(BaseCollector):
    source_name = "ECDC"

    async def collect(self) -> list[HealthEvent]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(ECDC_FEED)
            resp.raise_for_status()
        return self.parse_feed(resp.text)

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
        link = self._normalize_link(entry.get("link", ""))
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

    def _normalize_link(self, url: str) -> str:
        """Canonicalize known legacy ECDC article URL patterns."""
        try:
            parsed = urlparse(url)
        except Exception:
            return url
        if parsed.netloc.lower() != "www.ecdc.europa.eu":
            return url
        parts = [p for p in parsed.path.split("/") if p]
        # Legacy pattern seen in feeds: /en/<topic>/threats/<slug>
        if len(parts) >= 4 and parts[0] == "en" and parts[-2] == "threats":
            slug = parts[-1]
            return f"https://www.ecdc.europa.eu/en/news-events/{slug}"
        return url

    def _extract_disease_and_countries(self, title: str) -> tuple[str, list[str]]:
        # ECDC titles are mixed ("Disease – context" or reports without countries).
        parts = re.split(r"\s*[–—]\s*", title, maxsplit=1)
        disease = parts[0].strip() if parts else title
        disease = re.sub(r",\s*\d{1,2}\s+\w+\s*$", "", disease)
        disease = re.sub(r",\s*week\s+\d+\s*$", "", disease, flags=re.IGNORECASE)

        if len(parts) == 1:
            return disease, ["EU"]

        location = re.sub(r",?\s*week\s+\d+.*$", "", parts[1], flags=re.IGNORECASE).strip()
        if not location:
            return disease, ["EU"]

        if "eu/eea" in location.lower() or "europe" in location.lower():
            return disease, ["EU"]

        country_codes: list[str] = []
        for segment in re.split(r"[,/]|\band\b", location):
            candidate = segment.strip()
            if not candidate:
                continue
            for code in normalize_country(candidate):
                if code != "XX":
                    country_codes.append(code)

        return disease, sorted(set(country_codes)) if country_codes else ["EU"]
