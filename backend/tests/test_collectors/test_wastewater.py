from sentinel.collectors.wastewater import WastewaterCollector
from sentinel.models.event import Source, Species


class TestWastewaterCollector:
    def setup_method(self):
        self.collector = WastewaterCollector()

    def test_source_name(self):
        assert self.collector.source_name == "WASTEWATER"

    def test_parse_above_threshold(self):
        data = [
            {
                "pathogen": "SARS-CoV-2",
                "concentration": 5e6,
                "treatment_plant": "ARA Werdhölzli",
                "canton": "ZH",
                "sample_date": "2026-03-06",
                "url": "https://sensors-eawag.ch/sars/data",
            },
        ]
        events = self.collector.parse_measurements(data)
        assert len(events) == 1
        assert events[0].source == Source.WASTEWATER
        assert events[0].disease == "SARS-CoV-2"
        assert "CH-ZH" in events[0].regions
        assert events[0].species == Species.HUMAN
        assert "5.0x threshold" in events[0].title
        assert events[0].swiss_relevance == 1.0

    def test_below_threshold_skipped(self):
        data = [
            {
                "pathogen": "SARS-CoV-2",
                "concentration": 500,
                "canton": "ZH",
            },
        ]
        events = self.collector.parse_measurements(data)
        assert len(events) == 0

    def test_skips_empty_pathogen(self):
        data = [{"pathogen": "", "concentration": 1e9}]
        events = self.collector.parse_measurements(data)
        assert len(events) == 0

    async def test_collect_returns_empty_without_url(self):
        events = await self.collector.collect()
        assert events == []
