import logging
import re
from datetime import date

import feedparser
import httpx

from sentinel.analysis.normalizer import normalize_country
from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

WHO_DON_FEED = "https://www.who.int/feeds/entity/don/en/rss.xml"
WHO_DON_API_URL = "https://www.who.int/api/emergencies/diseaseoutbreaknews"


class WHODONCollector(BaseCollector):
    source_name = "WHO_DON"

    async def collect(self) -> list[HealthEvent]:
        async with httpx.AsyncClient(
            timeout=30,
            headers={"User-Agent": "SENTINEL/1.0"},
        ) as client:
            resp = await client.get(
                WHO_DON_API_URL,
                params={
                    "sf_provider": "dynamicProvider372",
                    "sf_culture": "en",
                    "$orderby": "PublicationDateAndTime desc",
                    "$top": 40,
                },
            )
            resp.raise_for_status()
        return self.parse_api_response(resp.json())

    def parse_api_response(self, data: dict | list) -> list[HealthEvent]:
        items = data if isinstance(data, list) else data.get("value", [])
        events: list[HealthEvent] = []
        for item in items:
            event = self._parse_api_item(item)
            if event:
                events.append(event)
        return events

    def _parse_api_item(self, item: dict) -> HealthEvent | None:
        title = str(item.get("OverrideTitle") or item.get("Title") or "").strip()
        if not title:
            return None

        summary = str(
            item.get("Summary")
            or item.get("Overview")
            or item.get("Assessment")
            or item.get("Advice")
            or ""
        ).strip()

        report_date = str(
            item.get("PublicationDateAndTime")
            or item.get("PublicationDate")
            or item.get("DateCreated")
            or ""
        )
        try:
            date_reported = date.fromisoformat(report_date[:10]) if report_date else date.today()
        except (ValueError, TypeError):
            date_reported = date.today()

        disease, countries = self._extract_disease_and_countries(title)
        if countries == ["XX"] and summary:
            countries = self._extract_countries_from_text(summary)

        species = self._detect_species(title, summary)

        item_url = str(item.get("ItemDefaultUrl", "")).strip()
        if item_url and not item_url.startswith("http"):
            item_url = (
                f"https://www.who.int/emergencies/disease-outbreak-news{item_url}"
            )
        if not item_url:
            item_url = "https://www.who.int/emergencies/disease-outbreak-news"

        raw_content_parts = [
            str(item.get("Summary", "")).strip(),
            str(item.get("Overview", "")).strip(),
            str(item.get("Assessment", "")).strip(),
            str(item.get("Advice", "")).strip(),
            str(item.get("Epidemiology", "")).strip(),
            str(item.get("Response", "")).strip(),
            str(item.get("FurtherInformation", "")).strip(),
        ]
        raw_content = "\n\n".join(part for part in raw_content_parts if part)

        return HealthEvent(
            source=Source.WHO_DON,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=countries,
            regions=[],
            species=species,
            summary=summary[:2000] if summary else title,
            url=item_url,
            raw_content=raw_content or summary or title,
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

        disease, countries = self._extract_disease_and_countries(title)
        species = self._detect_species(title, summary)

        return HealthEvent(
            source=Source.WHO_DON,
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

    def _detect_species(self, title: str, summary: str) -> Species:
        text = f"{title} {summary}".lower()
        animal_kw = ("avian", "animal", "poultry", "livestock", "cattle", "swine", "bird")
        human_kw = ("human case", "human infection", "patient", "hospitalized")
        has_animal = any(kw in text for kw in animal_kw)
        has_human = any(kw in text for kw in human_kw)
        if has_animal and has_human:
            return Species.BOTH
        if has_animal:
            return Species.ANIMAL
        return Species.HUMAN

    def _extract_disease_and_countries(self, title: str) -> tuple[str, list[str]]:
        # WHO DON titles are usually "Disease – Country/Region".
        parts = re.split(r"\s*[–—-]\s*", title, maxsplit=1)
        disease = parts[0].strip() if parts else title
        if len(parts) == 1:
            return disease, ["XX"]

        location = re.sub(r"\(.*?\)", "", parts[1]).strip()
        country_codes: list[str] = []
        for segment in re.split(r"[,/]|\band\b", location):
            candidate = segment.strip()
            if not candidate:
                continue
            for code in normalize_country(candidate):
                if code != "XX":
                    country_codes.append(code)

        return disease, sorted(set(country_codes)) if country_codes else ["XX"]

    def _extract_countries_from_text(self, text: str) -> list[str]:
        countries: list[str] = []
        for token in re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text):
            for code in normalize_country(token):
                if code != "XX" and code not in countries:
                    countries.append(code)
            if len(countries) >= 5:
                break
        return countries if countries else ["XX"]
