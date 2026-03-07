from collections import defaultdict

from fastapi import APIRouter, Depends

from sentinel.api.deps import get_store
from sentinel.projection import deduplicate_by_latest, load_projected_events
from sentinel.store import DataStore

router = APIRouter()


@router.get("/trends")
async def trends(store: DataStore = Depends(get_store)):
    """Events per day grouped by disease (for charts)."""
    events = deduplicate_by_latest(load_projected_events(store))
    data: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for e in events:
        day = e.date_reported.isoformat()
        data[day][e.disease] += 1
    return [
        {"date": day, "diseases": dict(diseases)}
        for day, diseases in sorted(data.items())
    ]


@router.get("/sources")
async def sources(store: DataStore = Depends(get_store)):
    """Events per source per day."""
    events = deduplicate_by_latest(load_projected_events(store))
    data: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for e in events:
        day = e.date_reported.isoformat()
        data[day][e.source] += 1
    return [
        {"date": day, "sources": dict(srcs)}
        for day, srcs in sorted(data.items())
    ]


@router.get("/risk-timeline")
async def risk_timeline(store: DataStore = Depends(get_store)):
    """Average risk score and swiss relevance per day."""
    events = deduplicate_by_latest(load_projected_events(store))
    buckets: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for e in events:
        day = e.date_reported.isoformat()
        buckets[day].append((e.risk_score, e.swiss_relevance))
    result = []
    for day in sorted(buckets):
        scores = buckets[day]
        avg_risk = sum(s[0] for s in scores) / len(scores)
        avg_relevance = sum(s[1] for s in scores) / len(scores)
        result.append({
            "date": day,
            "avg_risk_score": round(avg_risk, 2),
            "avg_swiss_relevance": round(avg_relevance, 2),
            "event_count": len(scores),
        })
    return result


@router.get("/collector-health")
async def collector_health(store: DataStore = Depends(get_store)):
    run_date, statuses = store.load_latest_collector_statuses()
    return {
        "run_date": run_date,
        "statuses": statuses,
    }


@router.get("/ingestion-delta")
async def ingestion_delta(store: DataStore = Depends(get_store)):
    run_date, delta = store.load_latest_ingestion_delta()
    return {
        "run_date": run_date,
        "delta": delta,
    }
