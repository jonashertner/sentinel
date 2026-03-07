from datetime import date

from sentinel.analysis.executive_ops import assess_executive_ops
from sentinel.analysis.rule_engine import score_event
from sentinel.analysis.swiss_relevance import compute_swiss_relevance
from sentinel.models.event import (
    HealthEvent,
    IMSActivation,
    LeadAgency,
    OperationalPriority,
    Source,
    Species,
)


def _make_event(
    *,
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


def _assess(event: HealthEvent) -> HealthEvent:
    event = score_event(event)
    event = compute_swiss_relevance(event)
    return assess_executive_ops(event)


def test_domestic_high_risk_requires_full_activation():
    event = _assess(
        _make_event(
            disease="Ebola",
            countries=["CH"],
            source=Source.WHO_DON,
            species=Species.HUMAN,
            death_count=3,
        )
    )
    assert event.operational_priority == OperationalPriority.CRITICAL
    assert event.ims_activation == IMSActivation.FULL_ACTIVATION
    assert event.decision_window_hours <= 24
    assert "executive_briefing" in event.trigger_flags


def test_animal_event_defaults_to_blv_lead():
    event = _assess(
        _make_event(
            disease="Lumpy skin disease",
            countries=["PL"],
            source=Source.WOAH,
            species=Species.ANIMAL,
        )
    )
    assert event.lead_agency == LeadAgency.BLV


def test_zoonotic_event_requires_joint_coordination():
    event = _assess(
        _make_event(
            disease="Avian influenza",
            countries=["FR"],
            source=Source.ECDC,
            species=Species.BOTH,
            case_count=150,
        )
    )
    assert event.lead_agency == LeadAgency.JOINT
    assert "one_health_coordination" in event.trigger_flags


def test_low_confidence_high_risk_triggers_rapid_verification():
    event = _assess(
        _make_event(
            disease="Ebola",
            countries=["DE"],
            source=Source.WHO_EIOS,
            species=Species.HUMAN,
            death_count=1,
        )
    )
    assert event.risk_score >= 6.0
    assert event.confidence_score < 0.65
    assert "rapid_verification" in event.trigger_flags
    assert event.decision_window_hours <= 12
