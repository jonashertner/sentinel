from datetime import date

from sentinel.models.event import HealthEvent, Source, Species
from sentinel.reports.daily_brief import generate_daily_brief


def _make_event(
    title: str = "Test Event",
    disease: str = "Measles",
    risk_score: float = 3.0,
    source: Source = Source.WHO_DON,
) -> HealthEvent:
    return HealthEvent(
        source=source,
        title=title,
        date_reported=date(2026, 3, 1),
        date_collected=date(2026, 3, 6),
        disease=disease,
        countries=["DE"],
        regions=["EURO"],
        species=Species.HUMAN,
        summary="An outbreak was reported.",
        url="https://example.com",
        raw_content="Full text",
        risk_score=risk_score,
    )


class TestDailyBrief:
    def test_contains_date_header(self):
        day = date(2026, 3, 6)
        report = generate_daily_brief(day, [])
        assert "2026-03-06" in report
        assert "SENTINEL Daily Intelligence Brief" in report

    def test_empty_events_valid_report(self):
        report = generate_daily_brief(date(2026, 3, 6), [])
        assert "**0** critical" in report
        assert "**0** high" in report

    def test_critical_before_low(self):
        critical_event = _make_event(
            title="Critical Event", risk_score=9.0, source=Source.ECDC
        )
        low_event = _make_event(title="Low Event", risk_score=2.0)
        report = generate_daily_brief(date(2026, 3, 6), [critical_event, low_event])
        # Critical section should appear before low section
        critical_pos = report.find("Critical & High Risk Events")
        low_pos = report.find("Low Risk Events")
        assert critical_pos < low_pos

    def test_source_summary_table(self):
        events = [
            _make_event(source=Source.WHO_DON),
            _make_event(source=Source.ECDC),
        ]
        report = generate_daily_brief(date(2026, 3, 6), events)
        assert "Source Summary" in report
        assert "| Source | Events |" in report
        assert "WHO_DON" in report
        assert "ECDC" in report

    def test_event_counts(self):
        events = [
            _make_event(risk_score=9.0),  # CRITICAL
            _make_event(risk_score=7.0),  # HIGH
            _make_event(risk_score=5.0),  # MEDIUM
            _make_event(risk_score=2.0),  # LOW
        ]
        report = generate_daily_brief(date(2026, 3, 6), events)
        assert "**4** health events" in report
        assert "**1** critical" in report
        assert "**1** high" in report
