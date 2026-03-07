"""Tests for IHR notification workflow."""

from datetime import date

from sentinel.ihr.models import Annex2Assessment, IHRStatus
from sentinel.ihr.workflow import auto_flag_events, start_assessment, update_assessment
from sentinel.models.event import HealthEvent, Source, Species


def _make_event(**kwargs) -> HealthEvent:
    defaults = dict(
        title="Test Event",
        source=Source.WHO_DON,
        date_reported=date(2026, 3, 7),
        date_collected=date(2026, 3, 7),
        disease="H5N1",
        countries=["CH", "DE"],
        regions=["EURO"],
        species=Species.ANIMAL,
        summary="Test",
        url="https://example.com",
        raw_content="Test",
    )
    defaults.update(kwargs)
    return HealthEvent(**defaults)


class TestAnnex2Assessment:
    def test_requires_notification_with_two_yes(self):
        a = Annex2Assessment(unusual=True, serious_impact=True)
        assert a.requires_notification is True

    def test_no_notification_with_one_yes(self):
        a = Annex2Assessment(unusual=True)
        assert a.requires_notification is False

    def test_no_notification_with_zero(self):
        a = Annex2Assessment()
        assert a.requires_notification is False

    def test_requires_notification_with_all_yes(self):
        a = Annex2Assessment(
            unusual=True,
            serious_impact=True,
            international_spread=True,
            trade_travel_risk=True,
        )
        assert a.requires_notification is True


class TestAutoFlagging:
    def test_flags_event_with_multiple_ihr_criteria(self):
        event = _make_event(
            ihr_unusual=True,
            ihr_serious_impact=True,
            ihr_international_spread=True,
        )
        flagged = auto_flag_events([event])
        assert len(flagged) == 1

    def test_no_flag_for_single_criterion(self):
        event = _make_event(ihr_unusual=True)
        flagged = auto_flag_events([event])
        assert len(flagged) == 0

    def test_flags_high_risk_multi_country(self):
        event = _make_event(risk_score=9.0, countries=["CH", "DE", "FR"])
        flagged = auto_flag_events([event])
        # risk_score >= 8 + multi-country = 1, but needs second criterion
        assert len(flagged) == 0

    def test_flags_high_risk_plus_ihr(self):
        event = _make_event(
            risk_score=9.0,
            countries=["CH", "DE"],
            ihr_unusual=True,
        )
        flagged = auto_flag_events([event])
        assert len(flagged) == 1


class TestWorkflow:
    def test_start_assessment(self, tmp_path, monkeypatch):
        monkeypatch.setattr("sentinel.ihr.workflow.settings.data_dir", str(tmp_path))
        notification = start_assessment(["evt-001"], "analyst@bag.admin.ch")
        assert notification.status == IHRStatus.ASSESSING
        assert notification.assessor == "analyst@bag.admin.ch"
        assert notification.deadline is not None

    def test_update_assessment_requires_notification(self, tmp_path, monkeypatch):
        monkeypatch.setattr("sentinel.ihr.workflow.settings.data_dir", str(tmp_path))
        notification = start_assessment(["evt-001"], "analyst@bag.admin.ch")

        assessment = Annex2Assessment(
            unusual=True,
            unusual_rationale="First H5N1 in CH poultry",
            serious_impact=True,
            serious_impact_rationale="Pandemic potential",
        )
        updated = update_assessment(notification.id, assessment)
        assert updated.status == IHRStatus.DRAFT

    def test_update_assessment_no_notification_needed(self, tmp_path, monkeypatch):
        monkeypatch.setattr("sentinel.ihr.workflow.settings.data_dir", str(tmp_path))
        notification = start_assessment(["evt-001"], "analyst@bag.admin.ch")

        assessment = Annex2Assessment(
            unusual=True,
            unusual_rationale="Known seasonal pattern",
        )
        updated = update_assessment(notification.id, assessment)
        assert updated.status == IHRStatus.CLOSED
