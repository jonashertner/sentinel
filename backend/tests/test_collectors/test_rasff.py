from sentinel.collectors.rasff import RASFFCollector
from sentinel.models.event import Source, Species


class TestRASFFCollector:
    def setup_method(self):
        self.collector = RASFFCollector()

    def test_source_name(self):
        assert self.collector.source_name == "RASFF"

    def test_parse_notifications(self):
        data = {
            "notifications": [
                {
                    "subject": "Salmonella in chicken from Poland",
                    "notifying_country": "Germany",
                    "distribution_countries": ["Switzerland", "France"],
                    "date": "2026-03-07",
                    "action_taken": "Withdrawal from market",
                    "url": "https://rasff.example.eu/123",
                },
            ],
        }
        events = self.collector.parse_notifications(data)
        assert len(events) == 1
        assert events[0].source == Source.RASFF
        assert events[0].disease == "Salmonella"
        assert events[0].species == Species.ANIMAL
        assert "CH" in events[0].countries
        assert events[0].swiss_relevance == 0.9  # CH in distribution

    def test_non_swiss_lower_relevance(self):
        data = {
            "notifications": [
                {
                    "subject": "Listeria in cheese from Italy",
                    "notifying_country": "Italy",
                    "distribution_countries": ["France", "Spain"],
                    "date": "2026-03-07",
                },
            ],
        }
        events = self.collector.parse_notifications(data)
        assert len(events) == 1
        assert events[0].swiss_relevance == 0.3

    def test_handles_list_format(self):
        data = [
            {
                "subject": "E. coli in lettuce from Spain",
                "notifying_country": "Spain",
                "date": "2026-03-07",
            },
        ]
        events = self.collector.parse_notifications(data)
        assert len(events) == 1
        assert events[0].disease == "E. coli"

    def test_skips_empty_subject(self):
        data = [{"subject": ""}]
        events = self.collector.parse_notifications(data)
        assert len(events) == 0
