from datetime import date

import pytest
from fastapi.testclient import TestClient

from sentinel.api.deps import get_store
from sentinel.main import app
from sentinel.models.event import HealthEvent, Source, Species
from sentinel.store import DataStore


def _make_event(**kwargs) -> HealthEvent:
    defaults = dict(
        title="Test Event",
        source=Source.WHO_DON,
        date_reported=date(2026, 3, 6),
        date_collected=date(2026, 3, 6),
        disease="H5N1",
        countries=["DE"],
        regions=["EURO"],
        species=Species.ANIMAL,
        summary="Test",
        url="https://example.com",
        raw_content="Test content",
        risk_score=7.5,
        swiss_relevance=6.0,
    )
    defaults.update(kwargs)
    return HealthEvent(**defaults)


@pytest.fixture()
def client(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    store.save_events(
        date(2026, 3, 6),
        [
            _make_event(),
            _make_event(
                disease="Dengue",
                countries=["BR"],
                risk_score=3.0,
                swiss_relevance=1.0,
            ),
            _make_event(
                disease="Mpox",
                countries=["CH"],
                source=Source.ECDC,
                risk_score=9.0,
                swiss_relevance=10.0,
            ),
        ],
    )
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestEventsAPI:
    def test_list_all_events(self, client):
        resp = client.get("/api/events")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_filter_by_country(self, client):
        resp = client.get("/api/events?country=CH")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["disease"] == "Mpox"

    def test_filter_by_disease(self, client):
        resp = client.get("/api/events?disease=H5N1")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_latest_events(self, client):
        resp = client.get("/api/events/latest")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_event_stats(self, client):
        resp = client.get("/api/events/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3

    def test_get_event_by_id(self, client):
        # Get list first to find an ID
        events = client.get("/api/events").json()
        event_id = events[0]["id"]
        resp = client.get(f"/api/events/{event_id}")
        assert resp.status_code == 200

    def test_get_event_not_found(self, client):
        resp = client.get("/api/events/nonexistent")
        assert resp.status_code == 404

    def test_health_check(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
