"""Decision playbooks for executive public health operations.

This module assigns hazard-specific playbooks, SLA timers, and escalation
workflows to each event so operational teams can act on consistent protocols.
"""

from sentinel.models.event import (
    EscalationLevel,
    HazardClass,
    HealthEvent,
    OperationalPriority,
    PlaybookType,
)

RESPIRATORY_DISEASES = {
    "COVID-19",
    "MERS",
    "Influenza A(H1N1)",
    "Avian influenza",
    "Avian influenza A(H5N1)",
    "Avian influenza A(H5N6)",
    "Avian influenza A(H7N9)",
}

PLAYBOOK_BY_HAZARD: dict[HazardClass, PlaybookType] = {
    HazardClass.PANDEMIC_RESPIRATORY: PlaybookType.PANDEMIC_RESPIRATORY,
    HazardClass.ZOONOTIC_SPILLOVER: PlaybookType.ZOONOTIC_SPILLOVER,
    HazardClass.FOODBORNE: PlaybookType.FOODBORNE_CONTAINMENT,
    HazardClass.VECTOR_BORNE: PlaybookType.VECTOR_CONTROL,
    HazardClass.GENERAL: PlaybookType.GENERAL_MONITORING,
}

PLAYBOOK_SLA_HOURS: dict[PlaybookType, dict[OperationalPriority, int]] = {
    PlaybookType.PANDEMIC_RESPIRATORY: {
        OperationalPriority.CRITICAL: 4,
        OperationalPriority.HIGH: 12,
        OperationalPriority.ELEVATED: 24,
        OperationalPriority.ROUTINE: 72,
    },
    PlaybookType.ZOONOTIC_SPILLOVER: {
        OperationalPriority.CRITICAL: 6,
        OperationalPriority.HIGH: 24,
        OperationalPriority.ELEVATED: 48,
        OperationalPriority.ROUTINE: 96,
    },
    PlaybookType.FOODBORNE_CONTAINMENT: {
        OperationalPriority.CRITICAL: 8,
        OperationalPriority.HIGH: 24,
        OperationalPriority.ELEVATED: 48,
        OperationalPriority.ROUTINE: 120,
    },
    PlaybookType.VECTOR_CONTROL: {
        OperationalPriority.CRITICAL: 8,
        OperationalPriority.HIGH: 24,
        OperationalPriority.ELEVATED: 72,
        OperationalPriority.ROUTINE: 168,
    },
    PlaybookType.GENERAL_MONITORING: {
        OperationalPriority.CRITICAL: 12,
        OperationalPriority.HIGH: 24,
        OperationalPriority.ELEVATED: 96,
        OperationalPriority.ROUTINE: 168,
    },
}

PLAYBOOK_WORKFLOWS: dict[PlaybookType, list[str]] = {
    PlaybookType.PANDEMIC_RESPIRATORY: [
        "Rapid respiratory threat briefing to BAG leadership.",
        "Activate hospital and laboratory surge readiness checkpoints.",
        "Issue cross-cantonal situational communication plan.",
        "Escalate to federal crisis coordination if transmission indicators rise.",
    ],
    PlaybookType.ZOONOTIC_SPILLOVER: [
        "Convene BAG-BLV One Health incident cell.",
        "Trigger animal-human interface investigation and targeted diagnostics.",
        "Align cantonal veterinary/public health control measures.",
        "Escalate federal coordination if spillover or cross-border spread is detected.",
    ],
    PlaybookType.FOODBORNE_CONTAINMENT: [
        "Trigger BLV-led food-chain traceback and source attribution.",
        "Coordinate import control and market surveillance checks.",
        "Issue risk communication to food safety and clinical networks.",
        "Escalate federal response if multi-canton exposure is confirmed.",
    ],
    PlaybookType.VECTOR_CONTROL: [
        "Initiate enhanced vector and environmental surveillance.",
        "Coordinate cantonal vector control readiness and diagnostics.",
        "Issue traveler and clinician advisories for at-risk areas.",
        "Escalate to interagency activation if local transmission is detected.",
    ],
    PlaybookType.GENERAL_MONITORING: [
        "Maintain routine surveillance and source verification.",
        "Review epidemiological indicators at scheduled checkpoints.",
        "Escalate to enhanced monitoring if risk trajectory increases.",
    ],
}

PLAYBOOK_ACTIONS: dict[PlaybookType, list[str]] = {
    PlaybookType.PANDEMIC_RESPIRATORY: [
        "Validate respiratory surveillance signals and run a rapid federal readiness check.",
        "Prepare cross-cantonal communication and clinical advisory updates.",
    ],
    PlaybookType.ZOONOTIC_SPILLOVER: [
        "Coordinate a joint BAG/BLV spillover assessment within the One Health framework.",
        "Launch targeted animal-human interface diagnostics and field verification.",
    ],
    PlaybookType.FOODBORNE_CONTAINMENT: [
        "Activate BLV traceback protocol and exposure mapping for implicated products.",
        "Coordinate cantonal food safety communication and control actions.",
    ],
    PlaybookType.VECTOR_CONTROL: [
        "Increase vector surveillance intensity and update regional risk maps.",
        "Issue preventive guidance for clinicians, laboratories, and travelers.",
    ],
    PlaybookType.GENERAL_MONITORING: [
        "Maintain routine monitoring and refresh the assessment at the next checkpoint.",
    ],
}


def _classify_hazard(event: HealthEvent) -> HazardClass:
    disease = event.disease
    combined_text = f"{event.title} {event.summary}".lower()

    if "foodborne" in event.one_health_tags:
        return HazardClass.FOODBORNE
    if "vector-borne" in event.one_health_tags:
        return HazardClass.VECTOR_BORNE
    if "zoonotic" in event.one_health_tags or event.species.value in {"animal", "both"}:
        return HazardClass.ZOONOTIC_SPILLOVER
    if disease in RESPIRATORY_DISEASES or "respir" in combined_text:
        return HazardClass.PANDEMIC_RESPIRATORY
    return HazardClass.GENERAL


def _escalation_level(event: HealthEvent) -> EscalationLevel:
    if event.operational_priority == OperationalPriority.CRITICAL:
        return EscalationLevel.NATIONAL_CRISIS
    if event.operational_priority == OperationalPriority.HIGH:
        return EscalationLevel.FEDERAL_ESCALATION
    if event.operational_priority == OperationalPriority.ELEVATED:
        return EscalationLevel.INTERAGENCY_COORDINATION
    return EscalationLevel.ROUTINE_SURVEILLANCE


def apply_playbook(event: HealthEvent) -> HealthEvent:
    """Assign a playbook, SLA, and escalation workflow to an event."""
    hazard_class = _classify_hazard(event)
    playbook = PLAYBOOK_BY_HAZARD[hazard_class]

    sla = PLAYBOOK_SLA_HOURS[playbook][event.operational_priority]
    escalation_level = _escalation_level(event)
    workflow = PLAYBOOK_WORKFLOWS[playbook]
    playbook_actions = PLAYBOOK_ACTIONS[playbook]

    event.hazard_class = hazard_class
    event.playbook = playbook
    event.playbook_sla_hours = sla
    event.sla_timer_hours = sla
    event.escalation_level = escalation_level
    event.escalation_workflow = workflow

    combined_actions: list[str] = []
    for action in event.recommended_actions + playbook_actions:
        if action not in combined_actions:
            combined_actions.append(action)
    event.recommended_actions = combined_actions[:6]

    playbook_flag = f"playbook:{playbook.value.lower()}"
    if playbook_flag not in event.trigger_flags:
        event.trigger_flags = sorted(set(event.trigger_flags + [playbook_flag]))
    return event


def apply_playbooks(events: list[HealthEvent]) -> list[HealthEvent]:
    """Assign playbooks to all events."""
    return [apply_playbook(event) for event in events]
