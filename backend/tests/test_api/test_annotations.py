from datetime import date

from fastapi.testclient import TestClient

from sentinel.api.deps import get_store
from sentinel.config import settings
from sentinel.main import app
from sentinel.models.event import HealthEvent, Source, Species
from sentinel.store import DataStore


def _annotation_body(**overrides):
    body = {
        "event_id": "evt-001",
        "author": "analyst@bag.ch",
        "type": "NOTE",
        "content": "Monitoring update",
        "visibility": "INTERNAL",
    }
    body.update(overrides)
    return body


def _seed_events(store: DataStore):
    store.save_events(
        date(2026, 3, 6),
        [
            HealthEvent(
                id="evt-001",
                title="Test Event 1",
                source=Source.WHO_DON,
                date_reported=date(2026, 3, 6),
                date_collected=date(2026, 3, 6),
                disease="H5N1",
                countries=["DE"],
                regions=["EURO"],
                species=Species.ANIMAL,
                summary="Test",
                url="https://example.com/1",
                raw_content="Test content 1",
                risk_score=6.0,
                swiss_relevance=5.0,
            ),
            HealthEvent(
                id="evt-002",
                title="Test Event 2",
                source=Source.ECDC,
                date_reported=date(2026, 3, 6),
                date_collected=date(2026, 3, 6),
                disease="Mpox",
                countries=["CH"],
                regions=["EURO"],
                species=Species.HUMAN,
                summary="Test",
                url="https://example.com/2",
                raw_content="Test content 2",
                risk_score=8.0,
                swiss_relevance=10.0,
            ),
        ],
    )


def test_create_annotation_server_managed_id(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed_events(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    resp = client.post("/api/annotations", json=_annotation_body())
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data and len(data["id"]) == 12

    app.dependency_overrides.clear()


def test_create_annotation_validates_risk_override(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed_events(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    resp = client.post(
        "/api/annotations",
        json=_annotation_body(risk_override=11.0),
    )
    assert resp.status_code == 422

    app.dependency_overrides.clear()


def test_list_annotations_by_event_id(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed_events(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    client.post("/api/annotations", json=_annotation_body(event_id="evt-001"))
    client.post("/api/annotations", json=_annotation_body(event_id="evt-002"))

    resp = client.get("/api/annotations?event_id=evt-001")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["event_id"] == "evt-001"

    app.dependency_overrides.clear()


def test_create_annotation_requires_existing_event(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed_events(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    resp = client.post(
        "/api/annotations",
        json=_annotation_body(event_id="evt-does-not-exist"),
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Event not found"

    app.dependency_overrides.clear()


def test_create_annotation_enforces_write_key_when_configured(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed_events(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    original_key = settings.api_write_key
    settings.api_write_key = "test-write-key"
    try:
        unauthorized = client.post("/api/annotations", json=_annotation_body())
        assert unauthorized.status_code == 401

        authorized = client.post(
            "/api/annotations",
            json=_annotation_body(),
            headers={"X-API-Key": "test-write-key"},
        )
        assert authorized.status_code == 201
    finally:
        settings.api_write_key = original_key
        app.dependency_overrides.clear()


def test_create_annotation_disabled_without_key_in_production(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed_events(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    original_key = settings.api_write_key
    original_env = settings.deployment_env
    settings.api_write_key = ""
    settings.deployment_env = "production"
    try:
        resp = client.post("/api/annotations", json=_annotation_body())
        assert resp.status_code == 503
    finally:
        settings.api_write_key = original_key
        settings.deployment_env = original_env
        app.dependency_overrides.clear()


def test_create_annotation_with_playbook_override(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    _seed_events(store)
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    resp = client.post(
        "/api/annotations",
        json=_annotation_body(
            playbook_override="VECTOR_CONTROL",
            playbook_sla_override_hours=24,
            escalation_level_override="INTERAGENCY_COORDINATION",
            override_reason="Cantonal vector signal upgrade",
        ),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["playbook_override"] == "VECTOR_CONTROL"
    assert data["playbook_sla_override_hours"] == 24
    assert data["escalation_level_override"] == "INTERAGENCY_COORDINATION"

    app.dependency_overrides.clear()
