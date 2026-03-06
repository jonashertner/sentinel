import json
from pathlib import Path

from sentinel.collectors.woah import WOAHCollector
from sentinel.models.event import Source, Species

FIXTURES = Path(__file__).parent.parent / "fixtures"


class TestWOAHCollector:
    def setup_method(self):
        self.collector = WOAHCollector()

    def test_source_name(self):
        assert self.collector.source_name == "WOAH"

    def test_parse_response(self):
        data = json.loads((FIXTURES / "woah_response.json").read_text())
        events = self.collector.parse_response(data)
        assert len(events) == 3

    def test_events_have_correct_source(self):
        data = json.loads((FIXTURES / "woah_response.json").read_text())
        events = self.collector.parse_response(data)
        for event in events:
            assert event.source == Source.WOAH

    def test_animal_species(self):
        data = json.loads((FIXTURES / "woah_response.json").read_text())
        events = self.collector.parse_response(data)
        for event in events:
            assert event.species in (Species.ANIMAL, Species.BOTH)

    def test_disease_extraction(self):
        data = json.loads((FIXTURES / "woah_response.json").read_text())
        events = self.collector.parse_response(data)
        assert events[0].disease == "Highly pathogenic avian influenza"

    def test_country_code_extraction(self):
        data = json.loads((FIXTURES / "woah_response.json").read_text())
        events = self.collector.parse_response(data)
        assert events[0].countries == ["DE"]
        assert events[1].countries == ["PL"]

    def test_url_construction(self):
        data = json.loads((FIXTURES / "woah_response.json").read_text())
        events = self.collector.parse_response(data)
        assert "wahis.woah.org" in events[0].url

    async def test_collect_handles_network_error(self):
        events = await self.collector.collect()
        assert isinstance(events, list)
