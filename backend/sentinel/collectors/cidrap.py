import asyncio
import logging
import re
from datetime import date, datetime
from html import unescape
from urllib.parse import urljoin

import feedparser
import httpx

from sentinel.analysis.normalizer import normalize_country
from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)

CIDRAP_FEED = "https://www.cidrap.umn.edu/feed/news.xml"
CIDRAP_ALL_NEWS = "https://www.cidrap.umn.edu/all-news"
CIDRAP_MAX_ARTICLES = 12


class CIDRAPCollector(BaseCollector):
    source_name = "CIDRAP"

    async def collect(self) -> list[HealthEvent]:
        async with httpx.AsyncClient(
            timeout=30,
            headers={"User-Agent": "SENTINEL/1.0"},
            follow_redirects=True,
        ) as client:
            feed_text = await self._get_text(client, CIDRAP_FEED)
            if feed_text:
                events = self.parse_feed(feed_text)
                if events:
                    return events

            listing_text = await self._get_text(client, CIDRAP_ALL_NEWS)
            if listing_text:
                listings = self.parse_all_news(listing_text)
                events = await self._collect_from_listings(client, listings[:CIDRAP_MAX_ARTICLES])
                if events:
                    return events

        raise RuntimeError("CIDRAP source unavailable: official feed returned no events")

    def parse_feed(self, xml: str) -> list[HealthEvent]:
        feed = feedparser.parse(xml)
        events = []
        for entry in feed.entries:
            event = self._parse_entry(entry)
            if event:
                events.append(event)
        return events

    def parse_all_news(self, html: str) -> list[dict[str, str]]:
        rows = re.findall(r'<div class="views-row">(.*?)</div>\s*</div>', html, flags=re.S)
        results: list[dict[str, str]] = []
        seen_links: set[str] = set()
        for row in rows:
            link_match = re.search(
                r'<a href="(?P<href>/[^"]+)"[^>]*class="field-group-link[^"]*"',
                row,
                flags=re.S,
            )
            title_match = re.search(r"<h3>\s*(?P<title>.*?)\s*</h3>", row, flags=re.S)
            teaser_match = re.search(
                r'field--name-field-teaser.*?<p>(?P<summary>.*?)</p>',
                row,
                flags=re.S,
            )
            if not link_match or not title_match:
                continue

            link = urljoin("https://www.cidrap.umn.edu", link_match.group("href"))
            if link in seen_links:
                continue
            seen_links.add(link)

            results.append(
                {
                    "link": link,
                    "title": self._clean_html_text(title_match.group("title")),
                    "summary": self._clean_html_text(teaser_match.group("summary")) if teaser_match else "",
                }
            )
        return results

    def parse_article_page(self, html: str) -> tuple[date | None, str, str]:
        time_match = re.search(
            r'<time datetime="(?P<datetime>[^"]+)" class="cidrap-publish-time">',
            html,
        )
        title_match = re.search(r'<meta property="og:title" content="(?P<title>[^"]+)"', html)
        summary_match = re.search(
            r'<meta property="og:description" content="(?P<summary>[^"]+)"',
            html,
        )

        published: date | None = None
        if time_match:
            try:
                published = datetime.fromisoformat(time_match.group("datetime")).date()
            except ValueError:
                published = None

        title = self._clean_html_text(title_match.group("title")) if title_match else ""
        summary = self._clean_html_text(summary_match.group("summary")) if summary_match else ""
        return published, title, summary

    async def _collect_from_listings(
        self,
        client: httpx.AsyncClient,
        listings: list[dict[str, str]],
    ) -> list[HealthEvent]:
        events: list[HealthEvent] = []
        for item in listings:
            article_text = await self._get_text(client, item["link"])
            if not article_text:
                continue

            published, title, summary = self.parse_article_page(article_text)
            if not published:
                continue

            resolved_title = title or item["title"]
            resolved_summary = summary or item["summary"] or resolved_title
            disease = self._extract_disease(resolved_title)
            countries = self._extract_countries(resolved_title, resolved_summary)
            species = self._detect_species(resolved_title)

            events.append(
                HealthEvent(
                    source=Source.CIDRAP,
                    title=resolved_title,
                    date_reported=published,
                    date_collected=date.today(),
                    disease=disease,
                    countries=countries,
                    regions=[],
                    species=species,
                    summary=resolved_summary[:2000],
                    url=item["link"],
                    raw_content=resolved_summary,
                )
            )
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

        disease = self._extract_disease(title)
        countries = self._extract_countries(title, summary)
        species = self._detect_species(title)

        return HealthEvent(
            source=Source.CIDRAP,
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

    def _extract_disease(self, title: str) -> str:
        """Extract disease name from CIDRAP headline."""
        known = [
            "H5N1", "H5N6", "H7N9", "avian flu", "bird flu",
            "mpox", "Ebola", "Marburg", "Nipah", "MERS", "COVID",
            "dengue", "cholera", "measles", "polio", "plague",
            "Zika", "chikungunya", "West Nile", "Rift Valley fever",
            "Lassa", "influenza", "RSV", "tuberculosis",
        ]
        lower = title.lower()
        for d in known:
            if d.lower() in lower:
                return d
        return title.split(":")[0].strip()[:80]

    def _extract_countries(self, title: str, summary: str) -> list[str]:
        """Extract country codes from title and summary."""
        countries: list[str] = []
        text = f"{title} {summary}"
        for token in re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text):
            codes = normalize_country(token)
            for c in codes:
                if c != "XX" and c not in countries:
                    countries.append(c)
            if len(countries) >= 5:
                break
        return countries if countries else ["XX"]

    def _detect_species(self, title: str) -> Species:
        lower = title.lower()
        if "avian" in lower or "bird" in lower or "animal" in lower:
            return Species.ANIMAL
        if "zoonotic" in lower:
            return Species.BOTH
        return Species.HUMAN

    def _clean_html_text(self, value: str) -> str:
        no_tags = re.sub(r"<[^>]+>", " ", value)
        normalized = re.sub(r"\s+", " ", unescape(no_tags).replace("\xa0", " "))
        return normalized.strip()

    async def _get_text(self, client: httpx.AsyncClient, url: str) -> str:
        resp = await client.get(url)
        if resp.status_code < 400:
            return resp.text
        if resp.status_code == 403:
            return await self._curl_get(url)
        return ""

    async def _curl_get(self, url: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "curl",
            "-L",
            "-s",
            url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _stderr = await proc.communicate()
        if proc.returncode != 0:
            return ""
        return stdout.decode("utf-8", "ignore")
