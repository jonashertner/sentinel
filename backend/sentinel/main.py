from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from sentinel.api import (
    alerts,
    analytics,
    annotations,
    events,
    exports,
    ihr,
    situations,
    watchlists,
)
from sentinel.config import settings
from sentinel.ws import manager

app = FastAPI(
    title="SENTINEL API",
    description="Swiss Epidemic Notification and Threat Intelligence Engine",
    version="0.1.0",
)

configured_origins = [
    origin.strip()
    for origin in settings.api_allowed_origins.split(",")
    if origin.strip()
]
allow_origins = configured_origins or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    # Browsers reject "*" + credentials, so only enable credentials for explicit origins.
    allow_credentials=allow_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(situations.router, prefix="/api/situations", tags=["situations"])
app.include_router(annotations.router, prefix="/api/annotations", tags=["annotations"])
app.include_router(watchlists.router, prefix="/api/watchlists", tags=["watchlists"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(exports.router, prefix="/api/exports", tags=["exports"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(ihr.router, prefix="/api/ihr", tags=["ihr"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "sentinel", "ws_connections": manager.active_count}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
