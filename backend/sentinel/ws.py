"""WebSocket manager for real-time push notifications."""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self):
        self._connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.append(ws)
        logger.info("WebSocket connected (%d total)", len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections = [c for c in self._connections if c is not ws]
        logger.info("WebSocket disconnected (%d remaining)", len(self._connections))

    async def broadcast(self, event_type: str, data: Any = None) -> None:
        """Send a typed message to all connected clients."""
        message = json.dumps({"type": event_type, "data": data}, default=str)
        async with self._lock:
            stale: list[WebSocket] = []
            for ws in self._connections:
                try:
                    await ws.send_text(message)
                except Exception:
                    stale.append(ws)
            for ws in stale:
                self._connections = [c for c in self._connections if c is not ws]

    @property
    def active_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()
