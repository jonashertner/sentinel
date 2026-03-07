from sentinel.collectors.nnsid import NNSIDCollector
from sentinel.models.event import Source, Species


class TestNNSIDCollector:
    def setup_method(self):
        self.collector = NNSIDCollector()

    def test_source_name(self):
        assert self.collector.source_name == "NNSID"

    def test_parse_notifications(self):
        data = [
            {
                "disease_name": "Masern",
                "canton": "ZH",
                "report_date": "2026-03-07",
                "case_count": 3,
                "summary": "Cluster in Zurich",
                "url": "https://nnsid.example.ch/123",
            },
            {
                "disease_name": "Salmonellose",
                "canton": "BE",
                "report_date": "2026-03-07",
                "case_count": 1,
                "summary": "Single case",
            },
        ]
        events = self.collector.parse_notifications(data)
        assert len(events) == 2
        assert events[0].source == Source.NNSID
        assert events[0].disease == "Masern"
        assert events[0].countries == ["CH"]
        assert "CH-ZH" in events[0].regions
        assert events[0].species == Species.HUMAN
        assert events[0].confidence_score == 0.98
        assert events[0].swiss_relevance == 1.0

    def test_skips_empty_disease(self):
        data = [{"disease_name": "", "canton": "ZH"}]
        events = self.collector.parse_notifications(data)
        assert len(events) == 0

    async def test_collect_returns_empty_without_credentials(self):
        events = await self.collector.collect()
        assert events == []
