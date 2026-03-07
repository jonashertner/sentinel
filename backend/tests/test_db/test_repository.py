"""Tests for the PostgreSQL repository layer.

These tests verify the row-conversion helpers (which don't need a database)
and the table definitions (which are verified structurally).
Full integration tests require a running PostgreSQL instance.
"""

from datetime import date

from sentinel.db.repository import (
    _annotation_to_row,
    _event_to_row,
    _row_to_annotation,
    _row_to_event,
    _row_to_situation,
    _situation_to_row,
)
from sentinel.db.tables import annotations, events, metadata, situations
from sentinel.models.annotation import Annotation, AnnotationType, Visibility
from sentinel.models.event import HealthEvent, Source, Species, VerificationStatus
from sentinel.models.situation import Situation


def _make_event(**kwargs) -> HealthEvent:
    defaults = dict(
        title="Test Event",
        source=Source.WHO_DON,
        date_reported=date(2026, 3, 6),
        date_collected=date(2026, 3, 6),
        disease="H5N1",
        countries=["CH"],
        regions=["EURO"],
        species=Species.ANIMAL,
        summary="Test summary",
        url="https://example.com",
        raw_content="Test content",
    )
    defaults.update(kwargs)
    return HealthEvent(**defaults)


def _make_annotation(**kwargs) -> Annotation:
    defaults = dict(
        event_id="evt-001",
        author="analyst@bag.admin.ch",
        type=AnnotationType.NOTE,
        content="Test annotation",
        visibility=Visibility.INTERNAL,
    )
    defaults.update(kwargs)
    return Annotation(**defaults)


def _make_situation(**kwargs) -> Situation:
    defaults = dict(
        title="H5N1 Outbreak in Europe",
        created=date(2026, 3, 6),
        events=["evt-001", "evt-002"],
        diseases=["H5N1"],
        countries=["CH", "DE"],
        lead_analyst="analyst@bag.admin.ch",
        summary="Ongoing H5N1 outbreak across Central Europe",
    )
    defaults.update(kwargs)
    return Situation(**defaults)


class TestEventConversion:
    def test_round_trip(self):
        event = _make_event()
        row = _event_to_row(event)
        restored = _row_to_event(row)
        assert restored.title == event.title
        assert restored.disease == event.disease
        assert restored.countries == event.countries
        assert restored.source == event.source

    def test_computed_field_stripped(self):
        event = _make_event(risk_score=9.0)
        row = _event_to_row(event)
        assert "risk_category" not in row

    def test_all_fields_present(self):
        event = _make_event(
            risk_score=7.5,
            swiss_relevance=0.8,
            one_health_tags=["zoonotic"],
            verification_status=VerificationStatus.CONFIRMED,
        )
        row = _event_to_row(event)
        assert row["risk_score"] == 7.5
        assert row["swiss_relevance"] == 0.8
        assert row["one_health_tags"] == ["zoonotic"]
        assert row["verification_status"] == "CONFIRMED"

    def test_jsonb_fields_are_lists(self):
        event = _make_event(countries=["CH", "DE"], regions=["EURO"])
        row = _event_to_row(event)
        assert isinstance(row["countries"], list)
        assert isinstance(row["regions"], list)


class TestAnnotationConversion:
    def test_round_trip(self):
        ann = _make_annotation()
        row = _annotation_to_row(ann)
        restored = _row_to_annotation(row)
        assert restored.event_id == ann.event_id
        assert restored.author == ann.author
        assert restored.content == ann.content

    def test_override_fields(self):
        ann = _make_annotation(
            type=AnnotationType.ASSESSMENT,
            risk_override=8.5,
            override_reason="Emerging cluster",
        )
        row = _annotation_to_row(ann)
        assert row["risk_override"] == 8.5
        assert row["override_reason"] == "Emerging cluster"


class TestSituationConversion:
    def test_round_trip(self):
        sit = _make_situation()
        row = _situation_to_row(sit)
        restored = _row_to_situation(row)
        assert restored.title == sit.title
        assert restored.events == sit.events
        assert restored.diseases == sit.diseases

    def test_annotations_stored_as_json(self):
        sit = _make_situation()
        row = _situation_to_row(sit)
        assert isinstance(row["annotations"], list)


class TestTableDefinitions:
    def test_events_table_columns(self):
        col_names = {c.name for c in events.columns}
        required = {
            "id", "date_collected", "source", "title", "date_reported",
            "disease", "countries", "regions", "species", "risk_score",
            "swiss_relevance", "verification_status", "operational_priority",
        }
        assert required.issubset(col_names)

    def test_annotations_table_columns(self):
        col_names = {c.name for c in annotations.columns}
        required = {"id", "event_id", "author", "timestamp", "type", "content"}
        assert required.issubset(col_names)

    def test_situations_table_columns(self):
        col_names = {c.name for c in situations.columns}
        required = {"id", "title", "status", "priority", "created", "events", "diseases"}
        assert required.issubset(col_names)

    def test_all_tables_in_metadata(self):
        table_names = set(metadata.tables.keys())
        expected = {
            "events", "annotations", "situations", "watchlists",
            "collector_runs", "audit_log", "reports",
        }
        assert expected == table_names
