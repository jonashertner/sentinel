from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from sentinel.api.deps import get_store
from sentinel.models.event import HealthEvent, RiskCategory, Source
from sentinel.projection import deduplicate_by_latest, load_projected_events
from sentinel.store import DataStore

router = APIRouter()


@router.get("", response_model=list[HealthEvent])
async def list_events(
    date_from: date | None = None,
    date_to: date | None = None,
    source: Source | None = None,
    disease: str | None = None,
    risk_category: RiskCategory | None = None,
    country: str | None = None,
    min_swiss_relevance: float | None = None,
    store: DataStore = Depends(get_store),
):
    events = deduplicate_by_latest(load_projected_events(store))

    if date_from:
        events = [e for e in events if e.date_reported >= date_from]
    if date_to:
        events = [e for e in events if e.date_reported <= date_to]
    if source:
        events = [e for e in events if e.source == source]
    if disease:
        events = [e for e in events if disease.lower() in e.disease.lower()]
    if risk_category:
        events = [e for e in events if e.risk_category == risk_category]
    if country:
        events = [e for e in events if country.upper() in e.countries]
    if min_swiss_relevance is not None:
        events = [e for e in events if e.swiss_relevance >= min_swiss_relevance]

    return sorted(events, key=lambda e: e.swiss_relevance, reverse=True)


@router.get("/latest", response_model=list[HealthEvent])
async def latest_events(store: DataStore = Depends(get_store)):
    events = deduplicate_by_latest(load_projected_events(store))
    if not events:
        return []
    latest_date = max(e.date_collected for e in events)
    return sorted(
        [e for e in events if e.date_collected == latest_date],
        key=lambda e: e.swiss_relevance,
        reverse=True,
    )


@router.get("/stats")
async def event_stats(store: DataStore = Depends(get_store)):
    events = deduplicate_by_latest(load_projected_events(store))
    by_source: dict[str, int] = {}
    by_risk: dict[str, int] = {}
    by_disease: dict[str, int] = {}
    for e in events:
        by_source[e.source] = by_source.get(e.source, 0) + 1
        by_risk[e.risk_category] = by_risk.get(e.risk_category, 0) + 1
        by_disease[e.disease] = by_disease.get(e.disease, 0) + 1
    return {
        "total": len(events),
        "by_source": by_source,
        "by_risk": by_risk,
        "by_disease": dict(
            sorted(by_disease.items(), key=lambda x: x[1], reverse=True)[:20]
        ),
    }


@router.get("/{event_id}/provenance")
async def event_provenance(event_id: str, store: DataStore = Depends(get_store)):
    events = deduplicate_by_latest(load_projected_events(store))
    for event in events:
        if event.id != event_id:
            continue

        nodes = [
            {
                "id": event.id,
                "label": event.title,
                "type": "merged_event",
                "source": event.source,
            }
        ]
        edges = []
        for evidence in event.source_evidence:
            source_node_id = f"{evidence.source}:{evidence.event_id}"
            nodes.append(
                {
                    "id": source_node_id,
                    "label": evidence.title,
                    "type": "source_event",
                    "source": evidence.source,
                    "url": evidence.url,
                    "date_reported": evidence.date_reported,
                    "confidence": evidence.confidence,
                }
            )
            edges.append(
                {
                    "from": source_node_id,
                    "to": event.id,
                    "confidence": evidence.confidence,
                }
            )

        return {
            "event_id": event.id,
            "provenance_hash": event.provenance_hash,
            "merged_from": event.merged_from,
            "source_evidence_count": len(event.source_evidence),
            "analyst_overrides_count": len(event.analyst_overrides),
            "nodes": nodes,
            "edges": edges,
        }

    raise HTTPException(status_code=404, detail="Event not found")


@router.get("/{event_id}", response_model=HealthEvent)
async def get_event(event_id: str, store: DataStore = Depends(get_store)):
    events = deduplicate_by_latest(load_projected_events(store))
    for e in events:
        if e.id == event_id:
            return e
    raise HTTPException(status_code=404, detail="Event not found")
