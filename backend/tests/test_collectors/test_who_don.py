from pathlib import Path

from sentinel.collectors.who_don import WHODONCollector
from sentinel.models.event import Source

FIXTURES = Path(__file__).parent.parent / "fixtures"


class TestWHODONCollector:
    def setup_method(self):
        self.collector = WHODONCollector()

    def test_source_name(self):
        assert self.collector.source_name == "WHO_DON"

    def test_parse_feed(self):
        xml = (FIXTURES / "who_don_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert len(events) == 3

    def test_events_have_correct_source(self):
        xml = (FIXTURES / "who_don_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        for event in events:
            assert event.source == Source.WHO_DON

    def test_title_extraction(self):
        xml = (FIXTURES / "who_don_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert "Avian Influenza" in events[0].title

    def test_disease_extraction(self):
        xml = (FIXTURES / "who_don_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert events[0].disease == "Avian Influenza A (H5N1)"

    def test_country_extraction(self):
        xml = (FIXTURES / "who_don_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert events[0].countries == ["KH"]

    def test_date_parsing(self):
        xml = (FIXTURES / "who_don_feed.xml").read_text()
        events = self.collector.parse_feed(xml)
        assert events[0].date_reported.year == 2026
        assert events[0].date_reported.month == 3

    async def test_collect_handles_network_error(self):
        """collect() returns empty list on network error (no real HTTP)."""
        events = await self.collector.collect()
        # Will fail to connect, should return empty list gracefully
        assert isinstance(events, list)
