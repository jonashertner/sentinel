"""Collector for Swiss wastewater surveillance data.

EAWAG and FOPH operate wastewater monitoring at ~100 Swiss treatment plants,
detecting SARS-CoV-2, influenza, RSV, and other pathogens. Wastewater data
provides early warning of outbreaks 7-10 days before clinical cases appear.
"""

import logging
from datetime import date

import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.config import settings
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

# Pathogen thresholds for generating events (gene copies / L)
PATHOGEN_THRESHOLDS = {
    "SARS-CoV-2": 1e6,
    "Influenza A": 1e5,
    "Influenza B": 1e5,
    "RSV": 1e5,
    "Norovirus": 1e6,
    "Mpox": 1e4,
}


class WastewaterCollector(BaseCollector):
    source_name = "WASTEWATER"

    async def collect(self) -> list[HealthEvent]:
        if not settings.wastewater_api_url:
            logger.warning("Wastewater API URL not configured, skipping")
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                settings.wastewater_api_url,
                params={"format": "json", "latest": "true"},
            )
            resp.raise_for_status()
            return self.parse_measurements(resp.json())

    def parse_measurements(self, data: list[dict]) -> list[HealthEvent]:
        events = []
        for item in data:
            event = self._parse_item(item)
            if event:
                events.append(event)
        return events

    def _parse_item(self, item: dict) -> HealthEvent | None:
        pathogen = item.get("pathogen", "")
        concentration = item.get("concentration", 0)
        plant = item.get("treatment_plant", "")
        canton = item.get("canton", "")

        if not pathogen:
            return None

        threshold = PATHOGEN_THRESHOLDS.get(pathogen, 1e6)
        above_threshold = concentration > threshold

        if not above_threshold:
            return None

        ratio = concentration / threshold if threshold else 0
        regions = [f"CH-{canton}"] if canton else ["CH"]

        return HealthEvent(
            source=Source.WASTEWATER,
            title=(
                f"Wastewater: {pathogen} elevated at "
                f"{plant or canton or 'CH'} ({ratio:.1f}x threshold)"
            ),
            date_reported=date.fromisoformat(
                item.get("sample_date", date.today().isoformat())
            ),
            date_collected=date.today(),
            disease=pathogen,
            countries=["CH"],
            regions=regions,
            species=Species.HUMAN,
            summary=(
                f"Concentration: {concentration:.0f} gc/L "
                f"(threshold: {threshold:.0f} gc/L, {ratio:.1f}x)"
            ),
            url=item.get("url", ""),
            raw_content=str(item),
            confidence_score=0.70,
            swiss_relevance=1.0,
        )
