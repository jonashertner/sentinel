from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sentinel.api import analytics, annotations, events, exports, situations, watchlists

app = FastAPI(
    title="SENTINEL API",
    description="Swiss Epidemic Notification and Threat Intelligence Engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # GitHub Pages domain in production
    allow_credentials=True,
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
