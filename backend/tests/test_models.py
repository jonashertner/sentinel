from datetime import date

from sentinel.models.annotation import Annotation, AnnotationType, EventStatus, Visibility
from sentinel.models.event import HealthEvent, RiskCategory, Source, Species
from sentinel.models.organization import ORGANIZATIONS
from sentinel.models.situation import Priority, Situation, SituationStatus


class TestHealthEvent:
    def test_create_minimal_event(self):
        event = HealthEvent(
            title="H5N1 outbreak in poultry",
            source=Source.WHO_DON,
            date_reported=date(2026, 3, 1),
            date_collected=date(2026, 3, 6),
            disease="Avian influenza A(H5N1)",
            countries=["DE"],
            regions=["EURO"],
            species=Species.ANIMAL,
            summary="Outbreak detected in commercial poultry farm.",
            url="https://who.int/don/123",
            raw_content="Full text...",
        )
        assert event.id
        assert event.risk_score == 0.0
        assert event.risk_category == RiskCategory.LOW

    def test_deterministic_id(self):
        kwargs = dict(
            title="Test",
            source=Source.WHO_DON,
            date_reported=date(2026, 3, 1),
            date_collected=date(2026, 3, 6),
            disease="H5N1",
            countries=["DE"],
            regions=["EURO"],
            species=Species.ANIMAL,
            summary="Test",
            url="https://example.com",
            raw_content="Test",
        )
        e1 = HealthEvent(**kwargs)
        e2 = HealthEvent(**kwargs)
        assert e1.id == e2.id

    def test_risk_category_from_score(self):
        event = HealthEvent(
            title="Test",
            source=Source.ECDC,
            date_reported=date(2026, 3, 1),
            date_collected=date(2026, 3, 6),
            disease="Test",
            countries=["CH"],
            regions=["EURO"],
            species=Species.HUMAN,
            summary="Test",
            url="https://example.com",
            raw_content="Test",
            risk_score=8.5,
        )
        assert event.risk_category == RiskCategory.CRITICAL


class TestAnnotation:
    def test_create_annotation(self):
        ann = Annotation(
            event_id="evt-123",
            author="Dr. Mueller",
            type=AnnotationType.ASSESSMENT,
            content="This is relevant due to Swiss poultry imports.",
            visibility=Visibility.SHARED,
        )
        assert ann.id
        assert ann.timestamp

    def test_risk_override(self):
        ann = Annotation(
            event_id="evt-123",
            author="Dr. Mueller",
            type=AnnotationType.ASSESSMENT,
            content="Upgrading risk.",
            visibility=Visibility.INTERNAL,
            risk_override=9.0,
            status_change=EventStatus.ESCALATED,
        )
        assert ann.risk_override == 9.0


class TestSituation:
    def test_create_situation(self):
        sit = Situation(
            title="H5N1 clade 2.3.4.4b — Europe 2026",
            diseases=["Avian influenza A(H5N1)"],
            countries=["DE", "FR", "NL"],
            lead_analyst="Dr. Mueller",
            summary="Ongoing avian influenza outbreak in European poultry.",
            swiss_impact_assessment="High risk due to migratory bird routes.",
        )
        assert sit.status == SituationStatus.ACTIVE
        assert sit.priority == Priority.P2


class TestOrganizations:
    def test_blv_config(self):
        blv = ORGANIZATIONS["BLV"]
        assert "zoonotic" in blv.domain_focus
        assert "animal" in blv.species_filter

    def test_bag_config(self):
        bag = ORGANIZATIONS["BAG"]
        assert "pandemic" in bag.domain_focus
        assert "human" in bag.species_filter
