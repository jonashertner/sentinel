from datetime import date

from sentinel.analysis.deduplicator import deduplicate
from sentinel.models.event import HealthEvent, Source, Species


def _make_event(
    disease: str = "Avian influenza",
    countries: list[str] | None = None,
    source: Source = Source.WHO_DON,
    date_reported: date = date(2026, 3, 1),
    summary: str = "Short summary",
    risk_score: float = 0.0,
    case_count: int | None = None,
    death_count: int | None = None,
) -> HealthEvent:
    return HealthEvent(
        source=source,
        title=f"{disease} outbreak",
        date_reported=date_reported,
        date_collected=date(2026, 3, 6),
        disease=disease,
        countries=countries or ["DE"],
        regions=["EURO"],
        species=Species.ANIMAL,
        summary=summary,
        url="https://example.com",
        raw_content=summary,
        risk_score=risk_score,
        case_count=case_count,
        death_count=death_count,
    )


class TestDeduplicate:
    def test_merge_same_disease_country_similar_date(self):
        e1 = _make_event(source=Source.ECDC, summary="A longer summary text here")
        e2 = _make_event(source=Source.PROMED, date_reported=date(2026, 3, 2), summary="Short")
        result = deduplicate([e1, e2])
        assert len(result) == 1
        # ECDC has higher priority
        assert result[0].source == Source.ECDC

    def test_different_diseases_not_merged(self):
        e1 = _make_event(disease="Avian influenza")
        e2 = _make_event(disease="Ebola")
        result = deduplicate([e1, e2])
        assert len(result) == 2

    def test_merged_keeps_longest_summary(self):
        e1 = _make_event(source=Source.ECDC, summary="Short")
        e2 = _make_event(source=Source.PROMED, summary="A much longer summary text")
        result = deduplicate([e1, e2])
        assert result[0].summary == "A much longer summary text"

    def test_merged_keeps_highest_risk_score(self):
        e1 = _make_event(risk_score=3.0)
        e2 = _make_event(risk_score=5.0, date_reported=date(2026, 3, 2))
        result = deduplicate([e1, e2])
        assert result[0].risk_score == 5.0

    def test_merged_keeps_highest_counts(self):
        e1 = _make_event(case_count=10, death_count=2)
        e2 = _make_event(
            case_count=50, death_count=5, date_reported=date(2026, 3, 2)
        )
        result = deduplicate([e1, e2])
        assert result[0].case_count == 50
        assert result[0].death_count == 5

    def test_merged_tracks_provenance_graph(self):
        e1 = _make_event(source=Source.WHO_DON, summary="A")
        e2 = _make_event(source=Source.PROMED, date_reported=date(2026, 3, 2), summary="B")
        result = deduplicate([e1, e2])
        merged = result[0]
        assert len(merged.merged_from) == 2
        assert len(merged.source_evidence) == 2
        assert merged.provenance_hash

    def test_single_event_passthrough(self):
        e1 = _make_event()
        result = deduplicate([e1])
        assert len(result) == 1
        assert result[0].title == e1.title

    def test_date_too_far_apart_not_merged(self):
        e1 = _make_event(date_reported=date(2026, 3, 1))
        e2 = _make_event(date_reported=date(2026, 3, 10))
        result = deduplicate([e1, e2])
        assert len(result) == 2
