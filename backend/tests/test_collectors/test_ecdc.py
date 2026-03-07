from pathlib import Path

import httpx
import pytest
import respx

from sentinel.collectors.ecdc import ECDC_FEED, ECDCCollector
from sentinel.models.event import Source, Species

FIXTURES = Path(__file__).parent.parent / "fixtures"


class TestECDCCollector:
    def setup_method(self):
        self.collector = ECDCCollector()

    def test_source_name(self):
        assert self.collector.source_name == "ECDC"

    def test_parse_feed(self):
        xml = (FIXTURES / "ecdc_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert len(events) == 2

    def test_events_have_correct_source(self):
        xml = (FIXTURES / "ecdc_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        for event in events:
            assert event.source == Source.ECDC

    def test_all_events_are_human(self):
        xml = (FIXTURES / "ecdc_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        for event in events:
            assert event.species == Species.HUMAN

    def test_disease_extraction(self):
        xml = (FIXTURES / "ecdc_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert "Measles" in events[0].disease

    def test_regions_include_euro(self):
        xml = (FIXTURES / "ecdc_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        for event in events:
            assert "EURO" in event.regions

    @respx.mock
    async def test_collect_raises_on_network_error(self):
        """collect() propagates exceptions so pipeline records structured status."""
        respx.get(ECDC_FEED).mock(return_value=httpx.Response(500))
        with pytest.raises(Exception):
            await self.collector.collect()
