from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sentinel.api import analytics, annotations, events, exports, situations, watchlists
from sentinel.config import settings

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


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "sentinel"}
