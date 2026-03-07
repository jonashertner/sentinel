"""Collector for EU Rapid Alert System for Food and Feed (RASFF).

RASFF notifications cover food safety hazards across EU/EEA countries.
Switzerland participates as an associated country. Relevant for BLV
(Federal Food Safety and Veterinary Office) and One Health surveillance.
"""

import logging
from datetime import date

import httpx

from sentinel.analysis.normalizer import normalize_country
from sentinel.collectors.base import BaseCollector
from sentinel.config import settings
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

# Common foodborne pathogens for disease extraction
FOODBORNE_HAZARDS = {
    "salmonella": "Salmonella",
    "listeria": "Listeria monocytogenes",
    "e. coli": "E. coli",
    "campylobacter": "Campylobacter",
    "norovirus": "Norovirus",
    "hepatitis a": "Hepatitis A",
    "aflatoxin": "Aflatoxin contamination",
    "pesticide": "Pesticide residue",
    "allergen": "Allergen contamination",
}


class RASFFCollector(BaseCollector):
    source_name = "RASFF"

    async def collect(self) -> list[HealthEvent]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                settings.rasff_api_url,
                params={"page": 1, "per_page": 50},
            )
            resp.raise_for_status()
            return self.parse_notifications(resp.json())

    def parse_notifications(self, data: dict) -> list[HealthEvent]:
        notifications = data if isinstance(data, list) else data.get("notifications", [])
        events = []
        for item in notifications:
            event = self._parse_item(item)
            if event:
                events.append(event)
        return events

    def _parse_item(self, item: dict) -> HealthEvent | None:
        subject = item.get("subject", "")
        if not subject:
            return None

        notifying_country = item.get("notifying_country", "")
        distribution = item.get("distribution_countries", [])
        if isinstance(distribution, str):
            distribution = [c.strip() for c in distribution.split(",")]

        countries = set()
        for c in [notifying_country] + distribution:
            for code in normalize_country(c):
                if code != "XX":
                    countries.add(code)

        swiss_relevant = "CH" in countries
        disease = self._extract_hazard(subject)

        return HealthEvent(
            source=Source.RASFF,
            title=f"RASFF: {subject}",
            date_reported=date.fromisoformat(
                item.get("date", date.today().isoformat())
            ),
            date_collected=date.today(),
            disease=disease,
            countries=sorted(countries) if countries else ["EU"],
            regions=["EURO"],
            species=Species.ANIMAL,
            summary=item.get("action_taken", subject),
            url=item.get("url", ""),
            raw_content=str(item),
            confidence_score=0.90,
            swiss_relevance=0.9 if swiss_relevant else 0.3,
            lead_agency="BLV",
        )

    def _extract_hazard(self, subject: str) -> str:
        lower = subject.lower()
        for key, name in FOODBORNE_HAZARDS.items():
            if key in lower:
                return name
        return "Food safety alert"
