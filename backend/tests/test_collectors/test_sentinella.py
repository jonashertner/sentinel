from sentinel.collectors.sentinella import SentinellaCollector
from sentinel.models.event import Source, Species


class TestSentinellaCollector:
    def setup_method(self):
        self.collector = SentinellaCollector()

    def test_source_name(self):
        assert self.collector.source_name == "SENTINELLA"

    def test_parse_reports(self):
        data = [
            {
                "disease": "Influenza",
                "week": "10",
                "week_start": "2026-03-02",
                "incidence_per_100k": 150.5,
                "threshold": 100.0,
                "case_count": 1200,
                "summary": "ILI incidence above seasonal threshold",
            },
        ]
        events = self.collector.parse_reports(data)
        assert len(events) == 1
        assert events[0].source == Source.SENTINELLA
        assert events[0].disease == "Influenza"
        assert "ABOVE THRESHOLD" in events[0].title
        assert events[0].species == Species.HUMAN
        assert events[0].swiss_relevance == 1.0

    def test_below_threshold_no_flag(self):
        data = [
            {
                "disease": "Influenza",
                "week": "10",
                "incidence_per_100k": 50.0,
                "threshold": 100.0,
            },
        ]
        events = self.collector.parse_reports(data)
        assert len(events) == 1
        assert "ABOVE THRESHOLD" not in events[0].title

    def test_skips_empty_disease(self):
        data = [{"disease": ""}]
        events = self.collector.parse_reports(data)
        assert len(events) == 0

    async def test_collect_returns_empty_without_url(self):
        events = await self.collector.collect()
        assert events == []
