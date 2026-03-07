"""Collector for BAG (Federal Office of Public Health) weekly bulletin.

Parses the BAG epidemiological bulletin for outbreak reports, case count updates,
and public health alerts published by the Swiss federal health authority.
"""

import logging
import re
from datetime import date

import httpx
from bs4 import BeautifulSoup

from sentinel.collectors.base import BaseCollector
from sentinel.config import settings
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)


class BAGBulletinCollector(BaseCollector):
    source_name = "BAG_BULLETIN"

    async def collect(self) -> list[HealthEvent]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(settings.bag_bulletin_url)
            resp.raise_for_status()
            return self.parse_page(resp.text)

    def parse_page(self, html: str) -> list[HealthEvent]:
        soup = BeautifulSoup(html, "lxml")
        events = []

        for article in soup.select("article, .mod-news, .teaser"):
            event = self._parse_article(article)
            if event:
                events.append(event)

        return events

    def _parse_article(self, article) -> HealthEvent | None:
        title_el = article.find(["h2", "h3", "h4", ".title"])
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        if not title:
            return None

        link_el = article.find("a", href=True)
        url = link_el["href"] if link_el else ""
        if url and not url.startswith("http"):
            url = f"https://www.bag.admin.ch{url}"

        summary_el = article.find(["p", ".lead", ".summary"])
        summary = summary_el.get_text(strip=True) if summary_el else ""

        disease = self._extract_disease(title)

        return HealthEvent(
            source=Source.BAG_BULLETIN,
            title=f"BAG: {title}",
            date_reported=date.today(),
            date_collected=date.today(),
            disease=disease,
            countries=["CH"],
            regions=["CH"],
            species=Species.HUMAN,
            summary=summary[:2000],
            url=url,
            raw_content=article.get_text(strip=True)[:5000],
            confidence_score=0.95,
            swiss_relevance=1.0,
        )

    def _extract_disease(self, title: str) -> str:
        known = [
            "Masern", "Measles", "Influenza", "Grippe", "COVID-19", "SARS-CoV-2",
            "Tuberkulose", "Tuberculosis", "Hepatitis", "Salmonellose", "Salmonella",
            "Legionellose", "Legionella", "Meningokokken", "Meningococcal",
            "FSME", "TBE", "Keuchhusten", "Pertussis", "Dengue", "Mpox",
            "HIV", "Syphilis", "Gonorrhoe", "Chlamydien", "Norovirus",
        ]
        for d in known:
            if re.search(rf"\b{re.escape(d)}\b", title, re.IGNORECASE):
                return d
        return title.split(",")[0].split("–")[0].strip()[:100]
