"""Executive operations scoring for Swiss public health decision support.

This layer transforms epidemiological event data into operational signals that
support BAG/BLV executive workflows: confidence, urgency, lead authority, and
time-bound action prompts.
"""

from sentinel.analysis.rule_engine import (
    HIGH_CONCERN_DISEASES,
    SWISS_NEIGHBORS,
    SWISS_TRADE_PARTNERS,
)
from sentinel.models.event import (
    HealthEvent,
    IMSActivation,
    LeadAgency,
    OperationalPriority,
    Source,
    Species,
    VerificationStatus,
)

SOURCE_CONFIDENCE: dict[Source, float] = {
    Source.WHO_DON: 0.95,
    Source.ECDC: 0.95,
    Source.WOAH: 0.90,
    Source.PROMED: 0.75,
    Source.WHO_EIOS: 0.60,
}

PRIORITY_TO_IMS: dict[OperationalPriority, IMSActivation] = {
    OperationalPriority.CRITICAL: IMSActivation.FULL_ACTIVATION,
    OperationalPriority.HIGH: IMSActivation.PARTIAL_ACTIVATION,
    OperationalPriority.ELEVATED: IMSActivation.ENHANCED_MONITORING,
    OperationalPriority.ROUTINE: IMSActivation.MONITORING,
}

BASE_DECISION_WINDOW_HOURS: dict[OperationalPriority, int] = {
    OperationalPriority.CRITICAL: 6,
    OperationalPriority.HIGH: 24,
    OperationalPriority.ELEVATED: 72,
    OperationalPriority.ROUTINE: 168,
}

ACTION_MAP: dict[str, str] = {
    "executive_briefing": "Convene BAG/BLV executive briefing with a decision memo.",
    "decision_due_24h": "Issue a formal decision checkpoint within 24 hours.",
    "domestic_signal": "Activate domestic incident coordination and prepare public communication.",
    "cross_border_signal": "Strengthen border-adjacent surveillance with cantonal focal points.",
    "rapid_verification": (
        "Launch rapid signal verification with source focal points and lab networks."
    ),
    "one_health_coordination": (
        "Activate a One Health coordination cell across human, animal, and environmental domains."
    ),
    "vector_readiness": "Increase vector and entomological surveillance in at-risk cantons.",
    "food_chain_readiness": "Coordinate BLV food-chain traceback and import screening as needed.",
    "severity_with_deaths": (
        "Review clinical surge capacity, referral pathways, and mortality monitoring."
    ),
    "ihr_review": (
        "Prepare IHR Annex 2 review package for National IHR Focal Point decision support."
    ),
}


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(min(value, maximum), minimum)


def _compute_confidence(event: HealthEvent) -> float:
    base = SOURCE_CONFIDENCE.get(event.source, 0.6)

    data_points = [
        event.case_count is not None,
        event.death_count is not None,
        bool(event.regions),
        bool(event.summary.strip()),
    ]
    completeness = sum(data_points) / len(data_points)

    confidence = 0.7 * base + 0.3 * completeness

    if event.verification_status == VerificationStatus.CONFIRMED:
        confidence += 0.05
    elif event.verification_status == VerificationStatus.PENDING:
        confidence -= 0.05
    elif event.verification_status == VerificationStatus.UNVERIFIED:
        confidence -= 0.10
    elif event.verification_status == VerificationStatus.REFUTED:
        confidence = 0.10

    return _clamp(confidence, 0.0, 1.0)


def _compute_probability(event: HealthEvent) -> float:
    score = 1.0

    if "CH" in event.countries:
        score = 5.0
    elif any(c in SWISS_NEIGHBORS for c in event.countries):
        score = 4.0
    elif event.swiss_relevance >= 6.0:
        score = 3.5
    elif any(c in SWISS_TRADE_PARTNERS for c in event.countries):
        score = 3.0
    elif event.swiss_relevance >= 4.0:
        score = 2.5

    if event.ihr_international_spread:
        score += 0.5
    if len(event.countries) > 1:
        score += 0.3
    if "vector-borne" in event.one_health_tags:
        score += 0.3

    if event.verification_status == VerificationStatus.PENDING:
        score -= 0.2
    elif event.verification_status == VerificationStatus.UNVERIFIED:
        score -= 0.4

    return _clamp(score, 0.0, 5.0)


def _compute_impact(event: HealthEvent) -> float:
    score = event.risk_score / 2.0

    if event.death_count is not None and event.death_count > 10:
        score += 1.0
    elif event.death_count is not None and event.death_count > 0:
        score += 0.6

    if event.case_count is not None and event.case_count > 1000:
        score += 0.6
    elif event.case_count is not None and event.case_count > 100:
        score += 0.3

    if event.disease in HIGH_CONCERN_DISEASES:
        score += 0.8
    if event.ihr_serious_impact:
        score += 0.6
    if "zoonotic" in event.one_health_tags:
        score += 0.4
    if event.species == Species.BOTH:
        score += 0.3

    return _clamp(score, 0.0, 5.0)


def _compute_priority(event: HealthEvent, probability: float, impact: float) -> OperationalPriority:
    ihr_flags = sum(
        bool(flag)
        for flag in (
            event.ihr_unusual,
            event.ihr_serious_impact,
            event.ihr_international_spread,
            event.ihr_trade_travel_risk,
        )
    )

    composite = (event.risk_score + event.swiss_relevance + (probability * 2) + (impact * 2)) / 4.0

    if "CH" in event.countries and (event.risk_score >= 6.0 or ihr_flags >= 2):
        return OperationalPriority.CRITICAL
    if composite >= 8.0 or ihr_flags >= 3:
        return OperationalPriority.CRITICAL
    if composite >= 6.5 or (event.risk_score >= 6.0 and event.swiss_relevance >= 4.0):
        return OperationalPriority.HIGH
    if composite >= 4.5 or event.risk_score >= 4.0:
        return OperationalPriority.ELEVATED
    return OperationalPriority.ROUTINE


def _assign_lead_agency(event: HealthEvent) -> LeadAgency:
    if event.species == Species.BOTH:
        return LeadAgency.JOINT
    if "zoonotic" in event.one_health_tags or "foodborne" in event.one_health_tags:
        return LeadAgency.JOINT
    if event.species == Species.ANIMAL:
        return LeadAgency.BLV
    return LeadAgency.BAG


def _decision_window(priority: OperationalPriority, confidence: float) -> int:
    window = BASE_DECISION_WINDOW_HOURS[priority]
    if priority in (OperationalPriority.CRITICAL, OperationalPriority.HIGH) and confidence < 0.65:
        window = min(window, 12)
    return window


def _derive_trigger_flags(
    event: HealthEvent,
    priority: OperationalPriority,
    decision_window_hours: int,
    confidence: float,
) -> list[str]:
    flags: list[str] = []

    if "CH" in event.countries:
        flags.append("domestic_signal")
    if any(c in SWISS_NEIGHBORS for c in event.countries):
        flags.append("cross_border_signal")
    if (
        event.ihr_unusual
        or event.ihr_serious_impact
        or event.ihr_international_spread
        or event.ihr_trade_travel_risk
    ):
        flags.append("ihr_review")
    if priority in (OperationalPriority.CRITICAL, OperationalPriority.HIGH):
        flags.append("executive_briefing")
    if decision_window_hours <= 24:
        flags.append("decision_due_24h")
    if event.risk_score >= 6.0 and confidence < 0.65:
        flags.append("rapid_verification")
    if "zoonotic" in event.one_health_tags:
        flags.append("one_health_coordination")
    if "vector-borne" in event.one_health_tags:
        flags.append("vector_readiness")
    if "foodborne" in event.one_health_tags:
        flags.append("food_chain_readiness")
    if event.death_count is not None and event.death_count > 0:
        flags.append("severity_with_deaths")

    return sorted(set(flags))


def _derive_recommended_actions(flags: list[str]) -> list[str]:
    ordered_flags = [
        "executive_briefing",
        "decision_due_24h",
        "domestic_signal",
        "cross_border_signal",
        "rapid_verification",
        "one_health_coordination",
        "vector_readiness",
        "food_chain_readiness",
        "severity_with_deaths",
        "ihr_review",
    ]

    actions = [ACTION_MAP[flag] for flag in ordered_flags if flag in flags and flag in ACTION_MAP]
    if not actions:
        actions = ["Maintain routine monitoring and refresh assessment if indicators change."]
    return actions[:5]


def assess_executive_ops(event: HealthEvent) -> HealthEvent:
    """Compute executive decision-support fields for a single event."""
    confidence = _compute_confidence(event)
    probability = _compute_probability(event)
    impact = _compute_impact(event)
    priority = _compute_priority(event, probability, impact)
    activation = PRIORITY_TO_IMS[priority]
    lead_agency = _assign_lead_agency(event)
    decision_window_hours = _decision_window(priority, confidence)
    trigger_flags = _derive_trigger_flags(event, priority, decision_window_hours, confidence)
    recommended_actions = _derive_recommended_actions(trigger_flags)

    event.confidence_score = round(confidence, 2)
    event.probability_score = round(probability, 2)
    event.impact_score = round(impact, 2)
    event.operational_priority = priority
    event.ims_activation = activation
    event.lead_agency = lead_agency
    event.decision_window_hours = decision_window_hours
    event.trigger_flags = trigger_flags
    event.recommended_actions = recommended_actions
    return event


def assess_events(events: list[HealthEvent]) -> list[HealthEvent]:
    """Compute executive decision-support fields for all events."""
    return [assess_executive_ops(event) for event in events]
