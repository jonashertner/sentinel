"""Centralized event projection: loads events + annotations → coherent state.

Every consumer (API, exports, analytics, reports) MUST use this module
to get events with analyst overrides applied and dependent fields reconciled.
"""

from collections import defaultdict
from datetime import date, timedelta
from sentinel.analysis.executive_ops import (
    BASE_DECISION_WINDOW_HOURS,
    PRIORITY_TO_IMS,
)
from sentinel.analysis.playbooks import (
    PLAYBOOK_BY_HAZARD,
    PLAYBOOK_SLA_HOURS,
    PLAYBOOK_WORKFLOWS,
    _escalation_level,
)
from sentinel.config import settings
from sentinel.models.annotation import Annotation
from sentinel.models.event import AnalystOverride, HealthEvent, Source
from sentinel.source_urls import canonicalize_event_urls, is_trusted_source_url
from sentinel.store import DataStore


def _reconcile_dependent_fields(
    event: HealthEvent, explicitly_set: set[str]
) -> HealthEvent:
    """Recompute fields that depend on operational_priority, playbook, etc.

    Called after analyst overrides to ensure IMS activation, decision window,
    SLA timers, and escalation workflow stay consistent.
    Fields in *explicitly_set* were directly overridden by the analyst and
    are not recomputed.
    """
    priority = event.operational_priority
    event.ims_activation = PRIORITY_TO_IMS[priority]
    event.decision_window_hours = BASE_DECISION_WINDOW_HOURS[priority]

    playbook = event.playbook

    # Only recompute SLA from the matrix if analyst didn't set it explicitly
    if "playbook_sla_hours" not in explicitly_set:
        event.playbook_sla_hours = PLAYBOOK_SLA_HOURS[playbook][priority]
        event.sla_timer_hours = event.playbook_sla_hours

    if "escalation_level" not in explicitly_set:
        event.escalation_level = _escalation_level(event)

    event.escalation_workflow = PLAYBOOK_WORKFLOWS[playbook]

    # Keep hazard class aligned with playbook (reverse lookup)
    for hc, pb in PLAYBOOK_BY_HAZARD.items():
        if pb == playbook:
            event.hazard_class = hc
            break

    return event


def deduplicate_by_latest(events: list[HealthEvent]) -> list[HealthEvent]:
    """When the same event ID appears across collection dates, keep latest observation."""
    latest: dict[str, HealthEvent] = {}
    for event in events:
        existing = latest.get(event.id)
        if existing is None or event.date_collected > existing.date_collected:
            latest[event.id] = event
    return list(latest.values())


def _filter_recent_events(events: list[HealthEvent]) -> list[HealthEvent]:
    max_age_days = settings.max_event_age_days
    if max_age_days <= 0:
        return events
    today = date.today()
    cutoff = today - timedelta(days=max_age_days)
    return [event for event in events if cutoff <= event.date_reported <= today]

def _filter_trusted_sources(events: list[HealthEvent]) -> list[HealthEvent]:
    who_eios_enabled = bool(settings.who_eios_api_key.strip())
    filtered: list[HealthEvent] = []
    for event in events:
        if event.source == Source.WHO_EIOS and not who_eios_enabled:
            continue
        if is_trusted_source_url(event.source, event.url):
            filtered.append(event)
    return filtered


def apply_annotation_overrides(
    events: list[HealthEvent],
    annotations: list[Annotation],
) -> list[HealthEvent]:
    """Apply analyst annotation overrides and reconcile dependent fields."""
    by_event: dict[str, list[Annotation]] = defaultdict(list)
    for annotation in annotations:
        by_event[annotation.event_id].append(annotation)
    for event_annotations in by_event.values():
        event_annotations.sort(key=lambda item: item.timestamp)

    enriched: list[HealthEvent] = []
    for event in events:
        updated = event.model_copy(deep=True)
        overrides: list[AnalystOverride] = list(updated.analyst_overrides)
        all_overridden_fields: set[str] = set()

        for annotation in by_event.get(updated.id, []):
            fields: list[str] = []

            if annotation.risk_override is not None:
                updated.risk_score = annotation.risk_override
                fields.append("risk_score")
            if annotation.verification_override is not None:
                updated.verification_status = annotation.verification_override
                fields.append("verification_status")
            if annotation.operational_priority_override is not None:
                updated.operational_priority = annotation.operational_priority_override
                fields.append("operational_priority")
            if annotation.playbook_override is not None:
                updated.playbook = annotation.playbook_override
                fields.append("playbook")
            if annotation.playbook_sla_override_hours is not None:
                updated.playbook_sla_hours = annotation.playbook_sla_override_hours
                updated.sla_timer_hours = annotation.playbook_sla_override_hours
                fields.append("playbook_sla_hours")
            if annotation.escalation_level_override is not None:
                updated.escalation_level = annotation.escalation_level_override
                fields.append("escalation_level")

            if fields:
                all_overridden_fields.update(fields)
                note = annotation.override_reason or annotation.content[:200]
                overrides.append(
                    AnalystOverride(
                        annotation_id=annotation.id,
                        author=annotation.author,
                        timestamp=annotation.timestamp,
                        fields=fields,
                        note=note,
                    )
                )

        if all_overridden_fields:
            updated.analyst_overrides = overrides
            updated.trigger_flags = sorted(set(updated.trigger_flags + ["analyst_override"]))
            # Reconcile dependent fields, preserving explicitly set ones
            updated = _reconcile_dependent_fields(updated, all_overridden_fields)

        enriched.append(updated)
    return enriched


def load_projected_events(store: DataStore) -> list[HealthEvent]:
    """Single entry point: load events with overrides applied and reconciled.

    All API routes, exports, analytics, and reports should use this.
    """
    events = [canonicalize_event_urls(event) for event in store.load_all_events()]
    events = _filter_trusted_sources(_filter_recent_events(events))
    annotations = store.load_annotations()
    return apply_annotation_overrides(events, annotations)
