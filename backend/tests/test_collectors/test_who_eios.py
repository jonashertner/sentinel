import json
from pathlib import Path

import httpx
import pytest
import respx

from sentinel.collectors.who_eios import EIOS_API_URL, WHOEIOSCollector
from sentinel.models.event import Source, Species

FIXTURES = Path(__file__).parent.parent / "fixtures"


class TestWHOEIOSCollector:
    def setup_method(self):
        self.collector = WHOEIOSCollector()

    def test_source_name(self):
        assert self.collector.source_name == "WHO_EIOS"

    def test_parse_response(self):
        data = json.loads((FIXTURES / "who_eios_response.json").read_text())
        events = self.collector.parse_response(data)
        assert len(events) == 2

    def test_events_have_correct_source(self):
        data = json.loads((FIXTURES / "who_eios_response.json").read_text())
        events = self.collector.parse_response(data)
        for event in events:
            assert event.source == Source.WHO_EIOS

    def test_disease_extraction(self):
        data = json.loads((FIXTURES / "who_eios_response.json").read_text())
        events = self.collector.parse_response(data)
        assert events[0].disease == "Cholera"
        assert events[1].disease == "Lassa fever"

    def test_country_extraction(self):
        data = json.loads((FIXTURES / "who_eios_response.json").read_text())
        events = self.collector.parse_response(data)
        assert events[0].countries == ["MZ"]

    def test_country_name_normalization(self):
        data = {
            "signals": [
                {
                    "title": "Cholera update",
                    "summary": "Update",
                    "url": "https://example.com/signal",
                    "date": "2026-03-03",
                    "disease": "Cholera",
                    "countries": ["Mozambique"],
                }
            ]
        }
        events = self.collector.parse_response(data)
        assert events[0].countries == ["MZ"]

    def test_species_defaults_to_human(self):
        data = json.loads((FIXTURES / "who_eios_response.json").read_text())
        events = self.collector.parse_response(data)
        for event in events:
            assert event.species == Species.HUMAN

    async def test_collect_without_api_key_returns_empty(self):
        events = await self.collector.collect()
        assert events == []

    @respx.mock
    async def test_collect_with_api_key_raises_on_network_error(self):
        collector = WHOEIOSCollector(api_key="test-key")
        respx.get(EIOS_API_URL).mock(return_value=httpx.Response(403))
        with pytest.raises(Exception):
            await collector.collect()
