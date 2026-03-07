from datetime import date

from fastapi.testclient import TestClient

from sentinel.api.deps import get_store
from sentinel.main import app
from sentinel.models.event import HealthEvent, Source, Species
from sentinel.models.situation import Situation
from sentinel.store import DataStore


def _seed(store: DataStore):
    store.save_events(
        date(2026, 3, 7),
        [
            HealthEvent(
                id="evt-ops-1",
                title="Operational event",
                source=Source.WHO_DON,
                date_reported=date(2026, 3, 7),
                date_collected=date(2026, 3, 7),
                disease="H5N1",
                countries=["DE"],
                regions=["EURO"],
                species=Species.ANIMAL,
                summary="Test event",
                url="https://www.who.int/test-ops",
                raw_content="test",
            )
        ],
    )
    store.save_situation(
        Situation(
            id="sit-ops-1",
            title="Ops Situation",
            diseases=["H5N1"],
            countries=["DE"],
            lead_analyst="analyst@bag.ch",
            summary="Test situation",
        )
    )


def test_event_operations_state_round_trip(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    get_empty = client.get("/api/operations/events/evt-ops-1")
    assert get_empty.status_code == 200
    assert get_empty.json()["triage_status"] is None

    saved = client.put(
        "/api/operations/events/evt-ops-1",
        json={
            "triage_status": "ESCALATE",
            "note": "Escalate to BAG duty officer",
            "updated_by": "analyst@bag.ch",
        },
    )
    assert saved.status_code == 200
    payload = saved.json()
    assert payload["triage_status"] == "ESCALATE"
    assert "BAG duty officer" in payload["note"]

    loaded = client.get("/api/operations/events/evt-ops-1")
    assert loaded.status_code == 200
    assert loaded.json()["triage_status"] == "ESCALATE"

    app.dependency_overrides.clear()


def test_situation_operations_state_round_trip(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    note_resp = client.post(
        "/api/operations/situations/sit-ops-1/annotations",
        json={"author": "analyst@bag.ch", "content": "Contact cantonal vet office"},
    )
    assert note_resp.status_code == 200
    assert len(note_resp.json()["annotations"]) == 1

    actions_resp = client.put(
        "/api/operations/situations/sit-ops-1/actions",
        json={"checked_action_indices": [2, 0, 2], "updated_by": "analyst@bag.ch"},
    )
    assert actions_resp.status_code == 200
    assert actions_resp.json()["checked_action_indices"] == [0, 2]

    merged = client.get("/api/operations/situations/sit-ops-1")
    assert merged.status_code == 200
    payload = merged.json()
    assert len(payload["annotations"]) == 1
    assert payload["checked_action_indices"] == [0, 2]

    app.dependency_overrides.clear()
