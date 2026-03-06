from datetime import date

from sentinel.analysis.normalizer import (
    assign_who_regions,
    normalize_country,
    normalize_disease,
    normalize_event,
)
from sentinel.models.event import HealthEvent, Source, Species


class TestNormalizeDisease:
    def test_avian_flu(self):
        assert normalize_disease("avian flu") == "Avian influenza"

    def test_monkeypox(self):
        assert normalize_disease("monkeypox") == "Mpox"

    def test_passthrough_unknown(self):
        assert normalize_disease("Unknown Disease X") == "Unknown Disease X"

    def test_case_insensitive(self):
        assert normalize_disease("AVIAN FLU") == "Avian influenza"

    def test_strips_whitespace(self):
        assert normalize_disease("  cholera  ") == "Cholera"


class TestNormalizeCountry:
    def test_germany(self):
        assert normalize_country("Germany") == ["DE"]

    def test_united_states(self):
        assert normalize_country("United States") == ["US"]

    def test_iso_code_passthrough(self):
        assert normalize_country("DE") == ["DE"]

    def test_case_insensitive(self):
        assert normalize_country("germany") == ["DE"]


class TestAssignWhoRegions:
    def test_euro_countries(self):
        assert assign_who_regions(["CH", "DE"]) == ["EURO"]

    def test_multiple_regions(self):
        regions = assign_who_regions(["DE", "US"])
        assert "EURO" in regions
        assert "AMRO" in regions

    def test_empty(self):
        assert assign_who_regions([]) == []


class TestNormalizeEvent:
    def test_integration(self):
        event = HealthEvent(
            source=Source.WHO_DON,
            title="Avian flu in Germany",
            date_reported=date(2026, 3, 1),
            date_collected=date(2026, 3, 6),
            disease="avian flu",
            countries=["Germany"],
            regions=[],
            species=Species.ANIMAL,
            summary="Outbreak detected.",
            url="https://example.com",
            raw_content="Full text",
        )
        result = normalize_event(event)
        assert result.disease == "Avian influenza"
        assert result.countries == ["DE"]
        assert "EURO" in result.regions
