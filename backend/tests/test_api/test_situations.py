from datetime import date

import pytest
from fastapi.testclient import TestClient

from sentinel.api.deps import get_store
from sentinel.main import app
from sentinel.models.event import HealthEvent, Source, Species
from sentinel.store import DataStore


@pytest.fixture()
def client(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    store.save_events(
        date(2026, 3, 6),
        [
            HealthEvent(
                id="evt-001",
                title="Seed Event 1",
                source=Source.WHO_DON,
                date_reported=date(2026, 3, 6),
                date_collected=date(2026, 3, 6),
                disease="H5N1",
                countries=["DE"],
                regions=["EURO"],
                species=Species.ANIMAL,
                summary="Seed",
                url="https://www.who.int/test-1",
                raw_content="seed",
            ),
            HealthEvent(
                id="evt-002",
                title="Seed Event 2",
                source=Source.ECDC,
                date_reported=date(2026, 3, 6),
                date_collected=date(2026, 3, 6),
                disease="Dengue",
                countries=["BR"],
                regions=["AMRO"],
                species=Species.HUMAN,
                summary="Seed",
                url="https://www.ecdc.europa.eu/en/test-2",
                raw_content="seed",
            ),
            HealthEvent(
                id="evt-003",
                title="Seed Event 3",
                source=Source.WOAH,
                date_reported=date(2026, 3, 6),
                date_collected=date(2026, 3, 6),
                disease="Mpox",
                countries=["CH"],
                regions=["EURO"],
                species=Species.HUMAN,
                summary="Seed",
                url="https://www.woah.org/en/test-3",
                raw_content="seed",
            ),
        ],
    )
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestSituationsAPI:
    def test_list_empty(self, client):
        resp = client.get("/api/situations")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_situation(self, client):
        body = {
            "title": "H5N1 Europe Spread",
            "diseases": ["H5N1"],
            "countries": ["DE", "FR"],
            "lead_analyst": "analyst@bag.ch",
            "summary": "H5N1 spreading across Europe",
        }
        resp = client.post("/api/situations", json=body)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "H5N1 Europe Spread"
        assert data["status"] == "ACTIVE"
        assert data["priority"] == "P2"
        assert "id" in data

    def test_get_situation(self, client):
        body = {
            "title": "Test Situation",
            "diseases": ["Dengue"],
            "countries": ["BR"],
            "lead_analyst": "analyst@bag.ch",
            "summary": "Test",
        }
        create_resp = client.post("/api/situations", json=body)
        sit_id = create_resp.json()["id"]

        resp = client.get(f"/api/situations/{sit_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == sit_id

    def test_get_situation_not_found(self, client):
        resp = client.get("/api/situations/nonexistent")
        assert resp.status_code == 404

    def test_update_situation(self, client):
        body = {
            "title": "Test",
            "diseases": ["Mpox"],
            "countries": ["CH"],
            "lead_analyst": "analyst@bag.ch",
            "summary": "Initial",
        }
        create_resp = client.post("/api/situations", json=body)
        sit_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/situations/{sit_id}",
            json={"status": "ESCALATED", "summary": "Updated summary"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ESCALATED"
        assert resp.json()["summary"] == "Updated summary"

    def test_link_events(self, client):
        body = {
            "title": "Test",
            "diseases": ["H5N1"],
            "countries": ["DE"],
            "lead_analyst": "analyst@bag.ch",
            "summary": "Test",
        }
        create_resp = client.post("/api/situations", json=body)
        sit_id = create_resp.json()["id"]

        resp = client.post(
            f"/api/situations/{sit_id}/events",
            json={"event_ids": ["evt-001", "evt-002"]},
        )
        assert resp.status_code == 200
        assert "evt-001" in resp.json()["events"]
        assert "evt-002" in resp.json()["events"]

    def test_link_events_no_duplicates(self, client):
        body = {
            "title": "Test",
            "diseases": ["H5N1"],
            "countries": ["DE"],
            "lead_analyst": "analyst@bag.ch",
            "summary": "Test",
        }
        create_resp = client.post("/api/situations", json=body)
        sit_id = create_resp.json()["id"]

        client.post(
            f"/api/situations/{sit_id}/events",
            json={"event_ids": ["evt-001"]},
        )
        resp = client.post(
            f"/api/situations/{sit_id}/events",
            json={"event_ids": ["evt-001", "evt-003"]},
        )
        assert resp.status_code == 200
        assert resp.json()["events"].count("evt-001") == 1
        assert "evt-003" in resp.json()["events"]

    def test_link_events_rejects_unknown_event(self, client):
        body = {
            "title": "Integrity Test",
            "diseases": ["H5N1"],
            "countries": ["DE"],
            "lead_analyst": "analyst@bag.ch",
            "summary": "Test",
        }
        create_resp = client.post("/api/situations", json=body)
        sit_id = create_resp.json()["id"]

        resp = client.post(
            f"/api/situations/{sit_id}/events",
            json={"event_ids": ["evt-999"]},
        )
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert "missing_event_ids" in detail
        assert detail["missing_event_ids"] == ["evt-999"]

    def test_create_situation_rejects_unknown_event(self, client):
        body = {
            "title": "Invalid seed links",
            "diseases": ["H5N1"],
            "countries": ["DE"],
            "lead_analyst": "analyst@bag.ch",
            "summary": "Test",
            "events": ["evt-001", "evt-404"],
        }
        resp = client.post("/api/situations", json=body)
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert detail["missing_event_ids"] == ["evt-404"]
