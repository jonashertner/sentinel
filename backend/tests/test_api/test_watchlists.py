from fastapi.testclient import TestClient

from sentinel.api.deps import get_store
from sentinel.main import app
from sentinel.store import DataStore


def test_watchlists_persist_to_store(tmp_path):
    store = DataStore(data_dir=str(tmp_path))
    app.dependency_overrides[get_store] = lambda: store
    client = TestClient(app)

    create = client.post(
        "/api/watchlists",
        json={
            "id": "wl-custom-1",
            "name": "Custom WL",
            "diseases": ["H5N1"],
            "countries": ["DE"],
            "min_risk_score": 5,
            "one_health_tags": ["zoonotic"],
        },
    )
    assert create.status_code == 201

    listed = client.get("/api/watchlists")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload) == 1
    assert payload[0]["id"] == "wl-custom-1"

    deleted = client.delete("/api/watchlists/wl-custom-1")
    assert deleted.status_code == 204

    listed_again = client.get("/api/watchlists")
    assert listed_again.status_code == 200
    assert listed_again.json() == []

    app.dependency_overrides.clear()
