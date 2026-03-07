from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from sentinel.api.deps import get_store
from sentinel.models.event import RiskCategory, Source
from sentinel.projection import load_projected_events
from sentinel.reports.csv_export import events_to_csv
from sentinel.store import DataStore

router = APIRouter()


class ExportFilter(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    source: Source | None = None
    disease: str | None = None
    risk_category: RiskCategory | None = None
    country: str | None = None
    min_swiss_relevance: float | None = None
    limit: int = Field(default=1000, le=10000)


def _filter_events(store: DataStore, f: ExportFilter):
    events = load_projected_events(store)
    if f.date_from:
        events = [e for e in events if e.date_reported >= f.date_from]
    if f.date_to:
        events = [e for e in events if e.date_reported <= f.date_to]
    if f.source:
        events = [e for e in events if e.source == f.source]
    if f.disease:
        events = [e for e in events if f.disease.lower() in e.disease.lower()]
    if f.risk_category:
        events = [e for e in events if e.risk_category == f.risk_category]
    if f.country:
        events = [e for e in events if f.country.upper() in e.countries]
    if f.min_swiss_relevance is not None:
        events = [e for e in events if e.swiss_relevance >= f.min_swiss_relevance]
    events = sorted(events, key=lambda e: e.swiss_relevance, reverse=True)
    return events[: f.limit]


@router.post("/csv")
async def export_csv(
    filters: ExportFilter = ExportFilter(),
    store: DataStore = Depends(get_store),
):
    events = _filter_events(store, filters)
    csv_content = events_to_csv(events)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sentinel_export.csv"},
    )


@router.post("/json")
async def export_json(
    filters: ExportFilter = ExportFilter(),
    store: DataStore = Depends(get_store),
):
    events = _filter_events(store, filters)
    return [e.model_dump(mode="json") for e in events]


@router.get("/reports/{report_date}")
async def get_report(report_date: date, store: DataStore = Depends(get_store)):
    content = store.load_report(report_date)
    if not content:
        raise HTTPException(status_code=404, detail="Report not found")
    return PlainTextResponse(content=content, media_type="text/markdown")
