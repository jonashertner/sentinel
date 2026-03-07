from datetime import date

from sentinel.analysis.executive_ops import assess_executive_ops
from sentinel.analysis.playbooks import apply_playbook
from sentinel.analysis.rule_engine import score_event
from sentinel.analysis.swiss_relevance import compute_swiss_relevance
from sentinel.models.event import (
    EscalationLevel,
    HazardClass,
    HealthEvent,
    PlaybookType,
    Source,
    Species,
)


def _make_event(
    *,
    disease: str,
    countries: list[str],
    source: Source = Source.WHO_DON,
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
        countries=countries,
        regions=[],
        species=species,
        case_count=case_count,
        death_count=death_count,
        summary="Event summary",
        url="https://example.com",
        raw_content="raw",
    )


def _pipeline_prep(event: HealthEvent) -> HealthEvent:
    event = score_event(event)
    event = compute_swiss_relevance(event)
    event = assess_executive_ops(event)
    return apply_playbook(event)


def test_assigns_pandemic_respiratory_playbook():
    event = _pipeline_prep(
        _make_event(
            disease="COVID-19",
            countries=["CH"],
            source=Source.WHO_DON,
            species=Species.HUMAN,
            death_count=5,
        )
    )
    assert event.hazard_class == HazardClass.PANDEMIC_RESPIRATORY
    assert event.playbook == PlaybookType.PANDEMIC_RESPIRATORY
    assert event.playbook_sla_hours <= 12


def test_assigns_foodborne_playbook_with_workflow():
    event = _pipeline_prep(
        _make_event(
            disease="Salmonellosis",
            countries=["DE"],
            source=Source.ECDC,
            species=Species.HUMAN,
            case_count=200,
        )
    )
    assert event.hazard_class == HazardClass.FOODBORNE
    assert event.playbook == PlaybookType.FOODBORNE_CONTAINMENT
    assert len(event.escalation_workflow) >= 3
    assert "playbook:foodborne_containment" in event.trigger_flags


def test_assigns_zoonotic_playbook_for_animal_human_interface():
    event = _pipeline_prep(
        _make_event(
            disease="Avian influenza",
            countries=["FR"],
            source=Source.WOAH,
            species=Species.BOTH,
            case_count=150,
        )
    )
    assert event.hazard_class == HazardClass.ZOONOTIC_SPILLOVER
    assert event.playbook == PlaybookType.ZOONOTIC_SPILLOVER


def test_critical_priority_maps_to_high_escalation_levels():
    event = _pipeline_prep(
        _make_event(
            disease="Ebola",
            countries=["CH"],
            source=Source.WHO_DON,
            species=Species.HUMAN,
            death_count=10,
        )
    )
    assert event.escalation_level in {
        EscalationLevel.FEDERAL_ESCALATION,
        EscalationLevel.NATIONAL_CRISIS,
    }
