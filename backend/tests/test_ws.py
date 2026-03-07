"""Tests for WebSocket manager."""

from starlette.testclient import TestClient

from sentinel.main import app


class TestWebSocket:
    def test_connect_and_receive(self):
        client = TestClient(app)
        with client.websocket_connect("/ws"):
            pass  # reaching here means connect succeeded

    def test_health_shows_connections(self):
        client = TestClient(app)
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert "ws_connections" in resp.json()
