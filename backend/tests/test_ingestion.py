from datetime import date

from sentinel.ingestion import compute_ingestion_delta
from sentinel.models.event import HealthEvent, Source, Species
from sentinel.store import DataStore


def _event(event_id: str, *, risk: float, collected: date) -> HealthEvent:
    return HealthEvent(
        id=event_id,
        source=Source.WHO_DON,
        title=f"Event {event_id}",
        date_reported=collected,
        date_collected=collected,
        disease="H5N1",
        countries=["DE"],
        regions=["EURO"],
        species=Species.ANIMAL,
        summary="summary",
        url="https://www.who.int/test",
        raw_content="raw",
        risk_score=risk,
    )


def test_compute_ingestion_delta_new_changed_retired(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    store.save_events(
        date(2026, 3, 6),
        [
            _event("evt-a", risk=5.0, collected=date(2026, 3, 6)),
            _event("evt-b", risk=4.0, collected=date(2026, 3, 6)),
        ],
    )
    store.save_events(
        date(2026, 3, 7),
        [
            _event("evt-a", risk=8.0, collected=date(2026, 3, 7)),  # changed
            _event("evt-c", risk=4.0, collected=date(2026, 3, 7)),  # new
        ],
    )

    delta = compute_ingestion_delta(store, date(2026, 3, 7))
    assert delta["new_count"] == 1
    assert delta["changed_count"] == 1
    assert delta["retired_count"] == 1
    assert delta["new_event_ids"] == ["evt-c"]
    assert delta["changed_event_ids"] == ["evt-a"]
    assert delta["retired_event_ids"] == ["evt-b"]
