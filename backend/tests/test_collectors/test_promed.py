from pathlib import Path

import httpx
import pytest
import respx

from sentinel.collectors.base import CollectorSkipped
from sentinel.collectors.promed import (
    PROMED_FEED,
    PROMED_POSTS_SITEMAP,
    PROMED_SEARCH,
    ProMEDCollector,
)
from sentinel.models.event import Source, Species

FIXTURES = Path(__file__).parent.parent / "fixtures"


class TestProMEDCollector:
    def setup_method(self):
        self.collector = ProMEDCollector()

    def test_source_name(self):
        assert self.collector.source_name == "PROMED"

    def test_parse_feed(self):
        xml = (FIXTURES / "promed_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert len(events) == 3

    def test_events_have_correct_source(self):
        xml = (FIXTURES / "promed_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        for event in events:
            assert event.source == Source.PROMED

    def test_animal_species_detection(self):
        xml = (FIXTURES / "promed_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        # First entry has PRO/AH/EDR prefix -> animal
        assert events[0].species == Species.ANIMAL

    def test_human_species_detection(self):
        xml = (FIXTURES / "promed_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        # Second entry has PRO> prefix -> human
        assert events[1].species == Species.HUMAN

    def test_disease_extraction(self):
        xml = (FIXTURES / "promed_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert "Avian influenza" in events[0].disease

    def test_title_preserved(self):
        xml = (FIXTURES / "promed_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert "PRO/AH/EDR>" in events[0].title

    @respx.mock
    async def test_collect_raises_on_network_error(self):
        """collect() propagates exceptions so pipeline records structured status."""
        respx.get(PROMED_FEED).mock(return_value=httpx.Response(500))
        with pytest.raises(Exception):
            await self.collector.collect()

    @respx.mock
    async def test_collect_marks_subscription_only_source_as_skipped(self):
        for url in (
            "https://www.promedmail.org/feed",
            "https://www.promedmail.org/feed/",
            PROMED_FEED,
        ):
            respx.get(url).mock(return_value=httpx.Response(404, text="missing"))
        respx.get(PROMED_POSTS_SITEMAP).mock(return_value=httpx.Response(200, text="<urlset></urlset>"))
        respx.get(PROMED_SEARCH).mock(
            return_value=httpx.Response(302, headers={"location": "/subscribe"})
        )

        with pytest.raises(CollectorSkipped):
            await self.collector.collect()
