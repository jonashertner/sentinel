"""WHO EIOS (Epidemic Intelligence from Open Sources) collector.

NOTE: Production use requires EIOS access credentials. This collector provides
a placeholder implementation that can be extended once credentials are available.
The public EIOS API is not openly accessible; this collector uses a configurable
endpoint and will gracefully return an empty list if access is unavailable.
"""

import logging
from datetime import date

import httpx

from sentinel.analysis.normalizer import normalize_country
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

            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "SENTINEL/1.0"},
            ) as client:
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
        raw_countries = item.get("countries", [])
        if isinstance(raw_countries, str):
            raw_countries = [raw_countries]
        elif not isinstance(raw_countries, list):
            raw_countries = []
        if not raw_countries:
            country = item.get("country", "")
            raw_countries = [country] if country else []

        country_codes: list[str] = []
        for raw_country in raw_countries:
            for code in normalize_country(str(raw_country).strip()):
                if code != "XX":
                    country_codes.append(code)
        if not country_codes:
            country_codes = ["XX"]
        else:
            country_codes = sorted(set(country_codes))

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
