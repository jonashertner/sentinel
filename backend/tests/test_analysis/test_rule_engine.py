from datetime import date

from sentinel.analysis.rule_engine import score_event
from sentinel.analysis.swiss_relevance import compute_swiss_relevance
from sentinel.models.event import HealthEvent, Source, Species


def _make_event(
    disease: str = "Measles",
    countries: list[str] | None = None,
    source: Source = Source.PROMED,
    species: Species = Species.HUMAN,
    case_count: int | None = None,
    death_count: int | None = None,
) -> HealthEvent:
    return HealthEvent(
        source=source,
        title=f"{disease} outbreak",
        date_reported=date(2026, 3, 1),
        date_collected=date(2026, 3, 6),
        disease=disease,
        countries=countries or ["XX"],
        regions=[],
        species=species,
        summary="An outbreak was reported.",
        url="https://example.com",
        raw_content="Full text",
        case_count=case_count,
        death_count=death_count,
    )


class TestScoreEvent:
    def test_neighboring_country_gets_geographic_score(self):
        event = _make_event(countries=["DE"])
        scored = score_event(event)
        assert scored.risk_score >= 3.0

    def test_high_concern_disease_gets_disease_score(self):
        event = _make_event(disease="Ebola")
        scored = score_event(event)
        assert scored.risk_score >= 2.5

    def test_zoonotic_event_tagged(self):
        event = _make_event(disease="Avian influenza", species=Species.BOTH)
        scored = score_event(event)
        assert "zoonotic" in scored.one_health_tags

    def test_vector_borne_tagged(self):
        event = _make_event(disease="Dengue")
        scored = score_event(event)
        assert "vector-borne" in scored.one_health_tags

    def test_foodborne_tagged(self):
        event = _make_event(disease="Salmonellosis")
        scored = score_event(event)
        assert "foodborne" in scored.one_health_tags

    def test_deaths_increase_score(self):
        event_no_deaths = _make_event()
        event_deaths = _make_event(death_count=20)
        s1 = score_event(event_no_deaths)
        s2 = score_event(event_deaths)
        assert s2.risk_score > s1.risk_score

    def test_authoritative_source_adds_score(self):
        event = _make_event(source=Source.ECDC)
        scored = score_event(event)
        event2 = _make_event(source=Source.PROMED)
        scored2 = score_event(event2)
        assert scored.risk_score > scored2.risk_score

    def test_switzerland_gets_max_geographic(self):
        event = _make_event(countries=["CH"])
        scored = score_event(event)
        assert scored.risk_score >= 4.0


class TestSwissRelevance:
    def test_switzerland_max_relevance(self):
        event = _make_event(countries=["CH"])
        event = score_event(event)
        result = compute_swiss_relevance(event)
        assert result.swiss_relevance == 10.0

    def test_neighbor_high_relevance(self):
        event = _make_event(countries=["DE"])
        event = score_event(event)
        result = compute_swiss_relevance(event)
        assert result.swiss_relevance >= 5.0

    def test_vector_borne_in_neighbor(self):
        event = _make_event(disease="Dengue", countries=["FR"])
        event = score_event(event)
        result = compute_swiss_relevance(event)
        # Gets neighbor score + vector disease score
        assert result.swiss_relevance >= 7.0

    def test_distant_country_low_relevance(self):
        event = _make_event(countries=["XX"])
        event = score_event(event)
        result = compute_swiss_relevance(event)
        assert result.swiss_relevance < 3.0
