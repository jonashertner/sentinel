from datetime import date

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
        url="https://www.who.int/example",
        raw_content="Test content",
        risk_score=7.5,
        swiss_relevance=6.0,
    )
    defaults.update(kwargs)
    return HealthEvent(**defaults)


class TestAnalyticsAPI:
    def test_sources_deduplicates_same_id_by_latest_collection(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        older = _make_event(date_collected=date(2026, 3, 6))
        newer = _make_event(
            id=older.id,
            date_collected=date(2026, 3, 7),
            risk_score=9.0,
        )
        store.save_events(date(2026, 3, 6), [older])
        store.save_events(date(2026, 3, 7), [newer])

        app.dependency_overrides[get_store] = lambda: store
        client = TestClient(app)
        resp = client.get("/api/analytics/sources")
        assert resp.status_code == 200
        payload = resp.json()
        total = sum(sum(day["sources"].values()) for day in payload)
        assert total == 1
        app.dependency_overrides.clear()
