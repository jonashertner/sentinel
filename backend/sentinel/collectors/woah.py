import logging
from datetime import date

import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

WOAH_API_URL = "https://wahis.woah.org/api/v1/pi/getReport/list"


class WOAHCollector(BaseCollector):
    source_name = "WOAH"

    async def collect(self) -> list[HealthEvent]:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    WOAH_API_URL,
                    json={
                        "pageNumber": 0,
                        "pageSize": 20,
                        "searchText": "",
                        "sortColName": "eventDate",
                        "sortColOrder": "DESC",
                    },
                )
                resp.raise_for_status()
            return self.parse_response(resp.json())
        except Exception:
            logger.exception("Failed to collect WOAH data")
            return []

    def parse_response(self, data: dict) -> list[HealthEvent]:
        """Parse the WOAH WAHIS API response into HealthEvents."""
        events = []
        reports = data if isinstance(data, list) else data.get("content", data.get("items", []))
        if isinstance(reports, dict):
            reports = reports.get("content", [])
        for report in reports:
            event = self._parse_report(report)
            if event:
                events.append(event)
        return events

    def _parse_report(self, report: dict) -> HealthEvent | None:
        disease = report.get("disease", report.get("diseaseName", ""))
        country = report.get("country", report.get("countryName", ""))
        title = report.get("title", f"{disease} - {country}")
        url = report.get("url", report.get("reportId", ""))
        summary = report.get("summary", report.get("description", title))
        report_date = report.get("eventDate", report.get("reportDate", ""))

        if not disease and not title:
            return None

        try:
            date_reported = date.fromisoformat(report_date[:10]) if report_date else date.today()
        except (ValueError, TypeError):
            date_reported = date.today()

        country_code = report.get("countryIso", report.get("iso3", ""))
        if country_code:
            country_code = country_code[:2].upper()
        else:
            country_code = country[:2].upper() if country else "XX"

        species_str = report.get("animalCategory", report.get("species", "animal"))
        has_human = species_str and "human" in str(species_str).lower()
        species = Species.BOTH if has_human else Species.ANIMAL

        if isinstance(url, int):
            url = f"https://wahis.woah.org/#/report-info?reportId={url}"
        elif not str(url).startswith("http"):
            url = f"https://wahis.woah.org/#/report-info?reportId={url}"

        return HealthEvent(
            source=Source.WOAH,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease if disease else "Unknown",
            countries=[country_code],
            regions=[],
            species=species,
            summary=str(summary)[:2000],
            url=url,
            raw_content=str(report),
        )
