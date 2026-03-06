"""WHO EIOS (Epidemic Intelligence from Open Sources) collector.

NOTE: Production use requires EIOS access credentials. This collector provides
a placeholder implementation that can be extended once credentials are available.
The public EIOS API is not openly accessible; this collector uses a configurable
endpoint and will gracefully return an empty list if access is unavailable.
"""

import logging
from datetime import date

import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

EIOS_API_URL = "https://portal.who.int/eios/api/signals"


class WHOEIOSCollector(BaseCollector):
    source_name = "WHO_EIOS"

    def __init__(self, api_url: str = EIOS_API_URL, api_key: str | None = None):
        self.api_url = api_url
        self.api_key = api_key

    async def collect(self) -> list[HealthEvent]:
        """Fetch signals from EIOS.

        Returns an empty list if credentials are not configured or the API
        is unreachable. This is expected behaviour for environments without
        EIOS access.
        """
        try:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(self.api_url, headers=headers)
                resp.raise_for_status()
            return self.parse_response(resp.json())
        except Exception:
            logger.exception("Failed to collect WHO EIOS data (credentials may be required)")
            return []

    def parse_response(self, data: dict | list) -> list[HealthEvent]:
        """Parse EIOS API response into HealthEvents."""
        events = []
        items = data if isinstance(data, list) else data.get("signals", data.get("items", []))
        for item in items:
            event = self._parse_item(item)
            if event:
                events.append(event)
        return events

    def _parse_item(self, item: dict) -> HealthEvent | None:
        title = item.get("title", "")
        if not title:
            return None

        summary = item.get("summary", item.get("description", ""))
        url = item.get("url", item.get("link", ""))
        report_date = item.get("date", item.get("publishedDate", ""))

        try:
            date_reported = date.fromisoformat(report_date[:10]) if report_date else date.today()
        except (ValueError, TypeError):
            date_reported = date.today()

        disease = item.get("disease", item.get("category", "Unknown"))
        country_codes = item.get("countries", [])
        if isinstance(country_codes, str):
            country_codes = [country_codes]
        if not country_codes:
            country = item.get("country", "")
            country_codes = [country[:2].upper()] if country else ["XX"]

        species_str = item.get("species", "human")
        if "animal" in str(species_str).lower():
            species = Species.ANIMAL
        elif "both" in str(species_str).lower():
            species = Species.BOTH
        else:
            species = Species.HUMAN

        return HealthEvent(
            source=Source.WHO_EIOS,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=country_codes,
            regions=[],
            species=species,
            summary=str(summary)[:2000],
            url=str(url),
            raw_content=str(item),
        )
