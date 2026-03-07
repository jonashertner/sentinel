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
PROMED_FEEDS = (
    "https://www.promedmail.org/feed",
    "https://www.promedmail.org/feed/",
    PROMED_FEED,
)
PROMED_POSTS_SITEMAP = "https://www.promedmail.org/posts-sitemap.xml"


class ProMEDCollector(BaseCollector):
    source_name = "PROMED"

    async def collect(self) -> list[HealthEvent]:
        async with httpx.AsyncClient(
            timeout=30,
            headers={"User-Agent": "SENTINEL/1.0"},
            follow_redirects=True,
        ) as client:
            # Try legacy/new feed URLs first.
            for url in PROMED_FEEDS:
                resp = await client.get(url)
                if resp.status_code >= 400:
                    continue
                events = self.parse_feed(resp.text)
                if events:
                    return events

            # Fallback: posts sitemap if feed access is unavailable.
            sitemap_resp = await client.get(PROMED_POSTS_SITEMAP)
            if sitemap_resp.status_code < 400:
                events = self.parse_posts_sitemap(sitemap_resp.text)
                if events:
                    return events

        raise RuntimeError(
            "ProMED source unavailable: feed and sitemap fallback returned no events"
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

    def parse_posts_sitemap(self, xml: str) -> list[HealthEvent]:
        events: list[HealthEvent] = []
        for loc, lastmod in re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", xml):
            url = loc.strip()
            if not url.startswith("http"):
                url = f"https://{url.lstrip('/')}"
            slug = url.rstrip("/").rsplit("/", 1)[-1]
            title = slug.replace("-", " ").strip().title()
            if not self._is_outbreak_signal_title(title):
                continue

            try:
                date_reported = date.fromisoformat(lastmod[:10])
            except (ValueError, TypeError):
                date_reported = date.today()

            disease, countries = self._extract_disease_and_countries(title)
            event = HealthEvent(
                source=Source.PROMED,
                title=title,
                date_reported=date_reported,
                date_collected=date.today(),
                disease=disease,
                countries=countries,
                regions=[],
                species=self._detect_species(title),
                summary="ProMED post metadata (fallback source).",
                url=url,
                raw_content=f"{title}\n{url}",
            )
            events.append(event)

        return events

    def _is_outbreak_signal_title(self, title: str) -> bool:
        lower = title.lower()
        keywords = (
            "outbreak",
            "influenza",
            "cholera",
            "dengue",
            "ebola",
            "marburg",
            "lassa",
            "mpox",
            "measles",
            "polio",
            "plague",
            "tuberculosis",
            "rabies",
            "chikungunya",
            "zika",
            "nipah",
            "mers",
            "cchf",
        )
        return any(keyword in lower for keyword in keywords)

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
