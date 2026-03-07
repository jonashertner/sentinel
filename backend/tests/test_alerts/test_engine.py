"""Tests for the alert evaluation engine."""

from datetime import UTC, date, datetime, timedelta

from sentinel.alerts.engine import evaluate_alerts, matches_condition, matches_rule
from sentinel.alerts.models import (
    AlertChannel,
    AlertCondition,
    AlertMatch,
    AlertOperator,
    AlertRule,
)
from sentinel.models.event import HealthEvent, Source, Species


def _make_event(**kwargs) -> HealthEvent:
    defaults = dict(
        title="H5N1 outbreak in poultry",
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
        risk_score=7.5,
        swiss_relevance=0.8,
    )
    defaults.update(kwargs)
    return HealthEvent(**defaults)


def _make_rule(**kwargs) -> AlertRule:
    defaults = dict(
        name="High risk alert",
        conditions=[
            AlertCondition(field="risk_score", operator=AlertOperator.GTE, value=7.0),
        ],
    )
    defaults.update(kwargs)
    return AlertRule(**defaults)


class TestMatchesCondition:
    def test_gte(self):
        event = _make_event(risk_score=7.5)
        cond = AlertCondition(field="risk_score", operator=AlertOperator.GTE, value=7.0)
        assert matches_condition(event, cond) is True

    def test_gte_below(self):
        event = _make_event(risk_score=5.0)
        cond = AlertCondition(field="risk_score", operator=AlertOperator.GTE, value=7.0)
        assert matches_condition(event, cond) is False

    def test_eq(self):
        event = _make_event(disease="H5N1")
        cond = AlertCondition(field="disease", operator=AlertOperator.EQ, value="H5N1")
        assert matches_condition(event, cond) is True

    def test_neq(self):
        event = _make_event(disease="H5N1")
        cond = AlertCondition(field="disease", operator=AlertOperator.NEQ, value="Ebola")
        assert matches_condition(event, cond) is True

    def test_contains_in_list(self):
        event = _make_event(countries=["CH", "DE"])
        cond = AlertCondition(
            field="countries", operator=AlertOperator.CONTAINS, value="CH"
        )
        assert matches_condition(event, cond) is True

    def test_contains_not_in_list(self):
        event = _make_event(countries=["DE", "FR"])
        cond = AlertCondition(
            field="countries", operator=AlertOperator.CONTAINS, value="CH"
        )
        assert matches_condition(event, cond) is False

    def test_in_operator(self):
        event = _make_event(disease="H5N1")
        cond = AlertCondition(
            field="disease", operator=AlertOperator.IN, value=["H5N1", "Ebola"]
        )
        assert matches_condition(event, cond) is True

    def test_missing_field(self):
        event = _make_event()
        cond = AlertCondition(
            field="nonexistent", operator=AlertOperator.EQ, value="x"
        )
        assert matches_condition(event, cond) is False


class TestMatchesRule:
    def test_all_conditions_must_match(self):
        event = _make_event(risk_score=8.0, disease="H5N1")
        rule = _make_rule(
            conditions=[
                AlertCondition(
                    field="risk_score", operator=AlertOperator.GTE, value=7.0
                ),
                AlertCondition(
                    field="disease", operator=AlertOperator.EQ, value="H5N1"
                ),
            ]
        )
        assert matches_rule(event, rule) is True

    def test_partial_match_fails(self):
        event = _make_event(risk_score=8.0, disease="Dengue")
        rule = _make_rule(
            conditions=[
                AlertCondition(
                    field="risk_score", operator=AlertOperator.GTE, value=7.0
                ),
                AlertCondition(
                    field="disease", operator=AlertOperator.EQ, value="H5N1"
                ),
            ]
        )
        assert matches_rule(event, rule) is False


class TestEvaluateAlerts:
    def test_matching_event_generates_alert(self):
        events = [_make_event(risk_score=8.0)]
        rules = [_make_rule()]
        matches = evaluate_alerts(events, rules)
        assert len(matches) == 1
        assert matches[0].event_id == events[0].id
        assert matches[0].rule_name == "High risk alert"

    def test_non_matching_event_no_alert(self):
        events = [_make_event(risk_score=3.0)]
        rules = [_make_rule()]
        matches = evaluate_alerts(events, rules)
        assert len(matches) == 0

    def test_inactive_rule_skipped(self):
        events = [_make_event(risk_score=8.0)]
        rules = [_make_rule(active=False)]
        matches = evaluate_alerts(events, rules)
        assert len(matches) == 0

    def test_cooldown_prevents_duplicate(self):
        event = _make_event(risk_score=8.0)
        rule = _make_rule(cooldown_minutes=60)
        recent = [
            AlertMatch(
                rule_id=rule.id,
                rule_name=rule.name,
                event_id=event.id,
                event_title=event.title,
                matched_at=datetime.now(UTC),
                channels=[AlertChannel.IN_APP],
            )
        ]
        matches = evaluate_alerts([event], [rule], recent_matches=recent)
        assert len(matches) == 0

    def test_expired_cooldown_allows_match(self):
        event = _make_event(risk_score=8.0)
        rule = _make_rule(cooldown_minutes=60)
        recent = [
            AlertMatch(
                rule_id=rule.id,
                rule_name=rule.name,
                event_id=event.id,
                event_title=event.title,
                matched_at=datetime.now(UTC) - timedelta(hours=2),
                channels=[AlertChannel.IN_APP],
            )
        ]
        matches = evaluate_alerts([event], [rule], recent_matches=recent)
        assert len(matches) == 1
