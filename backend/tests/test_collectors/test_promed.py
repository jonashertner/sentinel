from pathlib import Path

from sentinel.collectors.promed import ProMEDCollector
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

    async def test_collect_handles_network_error(self):
        events = await self.collector.collect()
        assert isinstance(events, list)
