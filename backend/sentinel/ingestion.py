"""Ingestion delta computation for run-over-run operational changes."""

import hashlib
import json
from datetime import date, timedelta

from sentinel.config import settings
from sentinel.models.event import HealthEvent, Source
from sentinel.source_urls import canonicalize_event_urls, is_trusted_source_url
from sentinel.store import DataStore


def _digest_event(event: HealthEvent) -> str:
    payload = event.model_dump(mode="json")
    # Compare substantive changes, not collection metadata.
    payload.pop("date_collected", None)
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _by_id(events: list[HealthEvent]) -> dict[str, HealthEvent]:
    data: dict[str, HealthEvent] = {}
    for event in events:
        data[event.id] = event
    return data


def _project_collection_events(
    events: list[HealthEvent],
    *,
    reference_day: date,
) -> list[HealthEvent]:
    who_eios_enabled = bool(settings.who_eios_api_key.strip())
    max_age_days = settings.max_event_age_days
    cutoff = reference_day - timedelta(days=max_age_days) if max_age_days > 0 else None

    projected: list[HealthEvent] = []
    for event in events:
        canonical = canonicalize_event_urls(event)
        if canonical.source == Source.WHO_EIOS and not who_eios_enabled:
            continue
        if not is_trusted_source_url(canonical.source, canonical.url):
            continue
        if cutoff is not None and not (cutoff <= canonical.date_reported <= reference_day):
            continue
        projected.append(canonical)
    return projected


def compute_ingestion_delta(store: DataStore, reference_day: date) -> dict:
    """Compare the latest collection to the immediately previous collection."""
    event_dates = sorted(p.stem for p in store.events_dir.glob("*.json"))
    if not event_dates:
        return {
            "latest_collection": "",
            "previous_collection": None,
            "new_count": 0,
            "changed_count": 0,
            "retired_count": 0,
            "new_event_ids": [],
            "changed_event_ids": [],
            "retired_event_ids": [],
            "new_by_source": {},
            "changed_by_source": {},
        }

    latest_day = reference_day.isoformat()
    if latest_day not in event_dates:
        latest_day = event_dates[-1]
    latest_idx = event_dates.index(latest_day)
    prev_day = event_dates[latest_idx - 1] if latest_idx > 0 else None

    latest_events = _by_id(
        _project_collection_events(
            store.load_events(date.fromisoformat(latest_day)),
            reference_day=date.fromisoformat(latest_day),
        )
    )
    prev_events = _by_id(
        _project_collection_events(
            store.load_events(date.fromisoformat(prev_day)),
            reference_day=date.fromisoformat(prev_day),
        )
    ) if prev_day else {}

    latest_ids = set(latest_events)
    prev_ids = set(prev_events)
    new_ids = sorted(latest_ids - prev_ids)
    retired_ids = sorted(prev_ids - latest_ids)

    changed_ids: list[str] = []
    for event_id in sorted(latest_ids & prev_ids):
        if _digest_event(latest_events[event_id]) != _digest_event(prev_events[event_id]):
            changed_ids.append(event_id)

    new_by_source: dict[str, int] = {}
    for event_id in new_ids:
        src = latest_events[event_id].source.value
        new_by_source[src] = new_by_source.get(src, 0) + 1

    changed_by_source: dict[str, int] = {}
    for event_id in changed_ids:
        src = latest_events[event_id].source.value
        changed_by_source[src] = changed_by_source.get(src, 0) + 1

    return {
        "latest_collection": latest_day,
        "previous_collection": prev_day,
        "new_count": len(new_ids),
        "changed_count": len(changed_ids),
        "retired_count": len(retired_ids),
        "new_event_ids": new_ids,
        "changed_event_ids": changed_ids,
        "retired_event_ids": retired_ids,
        "new_by_source": new_by_source,
        "changed_by_source": changed_by_source,
    }
