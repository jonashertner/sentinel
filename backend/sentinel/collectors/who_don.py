"""WHO Disease Outbreak News collector.

Uses the WHO public JSON API at /api/news/diseaseoutbreaknews which provides
structured data including title, summary, epidemiology, assessment, and dates.
"""

import logging
import re
from datetime import date

import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

WHO_DON_API = "https://www.who.int/api/news/diseaseoutbreaknews"


class WHODONCollector(BaseCollector):
    source_name = "WHO_DON"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "SENTINEL/1.0"}) as client:
                resp = await client.get(
                    WHO_DON_API,
                    params={
                        "sf_culture": "en",
                        "$orderby": "PublicationDateAndTime desc",
                        "$top": "30",
                    },
                )
                resp.raise_for_status()
            return self._parse_response(resp.json())
        except Exception:
            logger.exception("Failed to collect WHO DON data")
            return []

    def _parse_response(self, data: dict) -> list[HealthEvent]:
        events = []
        for item in data.get("value", []):
            event = self._parse_item(item)
            if event:
                events.append(event)
        return events

    def _parse_item(self, item: dict) -> HealthEvent | None:
        title = item.get("Title", "")
        if not title:
            return None

        summary = item.get("Summary", "") or ""
        overview = item.get("Overview", "") or ""
        assessment = item.get("Assessment", "") or ""
        don_id = item.get("DonId", "")
        url_name = item.get("UrlName", don_id)

        # Strip HTML tags from overview/assessment
        overview_text = re.sub(r"<[^>]+>", " ", overview).strip()[:1500]
        assessment_text = re.sub(r"<[^>]+>", " ", assessment).strip()[:500]

        # Build full summary
        full_summary = summary
        if overview_text and overview_text not in summary:
            full_summary = f"{summary} {overview_text}".strip()

        pub_date = item.get("PublicationDateAndTime", "")
        try:
            date_reported = date.fromisoformat(pub_date[:10])
        except (ValueError, TypeError):
            date_reported = date.today()

        disease, countries = self._extract_disease_and_countries(title)
        species = self._detect_species(title, full_summary)

        url = f"https://www.who.int/emergencies/disease-outbreak-news/item/{url_name}"

        return HealthEvent(
            source=Source.WHO_DON,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=countries,
            regions=[],
            species=species,
            summary=full_summary[:2000],
            url=url,
            raw_content=f"{summary}\n\n{overview_text}\n\nAssessment: {assessment_text}"[:3000],
        )

    def _detect_species(self, title: str, summary: str) -> Species:
        text = f"{title} {summary}".lower()
        animal_kw = ["avian", "animal", "poultry", "livestock", "cattle", "swine", "bird"]
        human_kw = ["human case", "human infection", "patient", "hospitalized"]
        has_animal = any(kw in text for kw in animal_kw)
        has_human = any(kw in text for kw in human_kw)
        if has_animal and has_human:
            return Species.BOTH
        if has_animal:
            return Species.ANIMAL
        return Species.HUMAN

    def _extract_disease_and_countries(self, title: str) -> tuple[str, list[str]]:
        # WHO DON titles: "Disease Name - Country" or "Disease – Country (region)"
        parts = re.split(r"\s*[–—-]\s*", title, maxsplit=1)
        disease = parts[0].strip() if parts else title

        countries: list[str] = []
        if len(parts) > 1:
            location = parts[1].strip()
            # Remove parenthetical info like "(region)" and split on commas/and
            location_clean = re.sub(r"\(.*?\)", "", location).strip()
            if location_clean:
                # Pass full country names — normalizer will resolve to ISO codes
                for segment in re.split(r"[,/]|\band\b", location_clean):
                    name = segment.strip()
                    if name:
                        countries.append(name)

        return disease, countries if countries else ["XX"]
