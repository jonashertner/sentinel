"""WHO Health News collector (replaces ProMED for PoC).

ProMED now requires subscription access. This collector pulls health-related
news items from the WHO public API as a supplementary intelligence source,
covering WHO situation reports, response updates, and health advisories.
"""

import logging
import re
from datetime import date

import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

WHO_NEWS_API = "https://www.who.int/api/news/newsitems"

# Keywords to filter for disease-relevant news
HEALTH_KEYWORDS = [
    "outbreak", "disease", "virus", "influenza", "dengue", "cholera",
    "mpox", "ebola", "marburg", "measles", "polio", "malaria",
    "meningitis", "plague", "yellow fever", "zika", "chikungunya",
    "tuberculosis", "hepatitis", "anthrax", "rabies", "lassa",
    "nipah", "hantavirus", "rift valley", "mers", "sars",
    "avian", "pandemic", "epidemic", "surveillance", "vaccine",
    "antimicrobial resistance", "AMR",
]


class ProMEDCollector(BaseCollector):
    """Collects health-related WHO news items as supplementary intelligence."""

    source_name = "PROMED"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "SENTINEL/1.0"}) as client:
                resp = await client.get(
                    WHO_NEWS_API,
                    params={
                        "sf_culture": "en",
                        "$orderby": "PublicationDateAndTime desc",
                        "$top": "50",
                    },
                )
                resp.raise_for_status()
            return self._parse_response(resp.json())
        except Exception:
            logger.exception("Failed to collect WHO News data")
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
        summary = item.get("Summary", "") or ""

        if not title:
            return None

        # Filter: only health/disease relevant items
        text = f"{title} {summary}".lower()
        if not any(kw in text for kw in HEALTH_KEYWORDS):
            return None

        pub_date = item.get("PublicationDateAndTime", "")
        try:
            date_reported = date.fromisoformat(pub_date[:10])
        except (ValueError, TypeError):
            date_reported = date.today()

        url_name = item.get("UrlName", "")
        item_url = item.get("ItemDefaultUrl", "")
        if item_url:
            url = f"https://www.who.int{item_url}"
        elif url_name:
            url = f"https://www.who.int/news/item/{url_name}"
        else:
            url = ""

        disease = self._extract_disease(title, summary)
        species = self._detect_species(title, summary)

        return HealthEvent(
            source=Source.PROMED,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=["XX"],  # WHO news items are typically global
            regions=[],
            species=species,
            summary=summary[:2000],
            url=url,
            raw_content=summary,
        )

    def _extract_disease(self, title: str, summary: str) -> str:
        text = f"{title} {summary}".lower()
        disease_map = {
            "influenza": "Influenza",
            "avian influenza": "Avian influenza",
            "dengue": "Dengue",
            "cholera": "Cholera",
            "mpox": "Mpox",
            "ebola": "Ebola virus disease",
            "marburg": "Marburg virus disease",
            "measles": "Measles",
            "polio": "Poliomyelitis",
            "malaria": "Malaria",
            "yellow fever": "Yellow fever",
            "nipah": "Nipah virus infection",
            "mers": "MERS-CoV",
            "chikungunya": "Chikungunya",
            "zika": "Zika virus disease",
        }
        for keyword, disease_name in disease_map.items():
            if keyword in text:
                return disease_name
        return title.split("–")[0].split("-")[0].strip()[:100]

    def _detect_species(self, title: str, summary: str) -> Species:
        text = f"{title} {summary}".lower()
        if any(kw in text for kw in ["avian", "animal", "livestock", "poultry", "veterinary"]):
            if any(kw in text for kw in ["human", "patient", "case"]):
                return Species.BOTH
            return Species.ANIMAL
        return Species.HUMAN
