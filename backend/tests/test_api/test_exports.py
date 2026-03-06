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
            _make_event(disease="Dengue", countries=["BR"], risk_score=3.0, swiss_relevance=1.0),
        ],
    )
    store.save_report(date(2026, 3, 6), "# Daily Brief\n\nTest report content.")
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestExportsAPI:
    def test_export_csv(self, client):
        resp = client.post("/api/exports/csv", json={})
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        lines = resp.text.strip().split("\n")
        # Header + 2 data rows
        assert len(lines) == 3
        assert "id" in lines[0]
        assert "H5N1" in resp.text

    def test_export_csv_with_filter(self, client):
        resp = client.post("/api/exports/csv", json={"disease": "H5N1"})
        assert resp.status_code == 200
        lines = resp.text.strip().split("\n")
        assert len(lines) == 2  # Header + 1 matching row

    def test_export_json(self, client):
        resp = client.post("/api/exports/json", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_export_json_with_filter(self, client):
        resp = client.post("/api/exports/json", json={"country": "BR"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["disease"] == "Dengue"

    def test_get_report(self, client):
        resp = client.get("/api/exports/reports/2026-03-06")
        assert resp.status_code == 200
        assert "Daily Brief" in resp.text

    def test_get_report_not_found(self, client):
        resp = client.get("/api/exports/reports/2020-01-01")
        assert resp.status_code == 404
