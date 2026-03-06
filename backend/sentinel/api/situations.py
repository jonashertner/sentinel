from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from sentinel.api.deps import get_store, require_write_access
from sentinel.models.situation import Priority, Situation, SituationStatus
from sentinel.store import DataStore

router = APIRouter()


class SituationCreate(BaseModel):
    title: str
    diseases: list[str]
    countries: list[str]
    lead_analyst: str
    priority: Priority = Priority.P2
    summary: str
    events: list[str] = Field(default_factory=list)


class SituationUpdate(BaseModel):
    title: str | None = None
    status: SituationStatus | None = None
    priority: Priority | None = None
    summary: str | None = None
    lead_analyst: str | None = None
    swiss_impact_assessment: str | None = None
    recommended_actions: list[str] | None = None


class EventLink(BaseModel):
    event_ids: list[str]


@router.get("", response_model=list[Situation])
async def list_situations(store: DataStore = Depends(get_store)):
    return store.load_situations()


@router.post("", response_model=Situation, status_code=201)
async def create_situation(
    body: SituationCreate,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    situation = Situation(**body.model_dump())
    store.save_situation(situation)
    return situation


@router.get("/{situation_id}", response_model=Situation)
async def get_situation(situation_id: str, store: DataStore = Depends(get_store)):
    for s in store.load_situations():
        if s.id == situation_id:
            return s
    raise HTTPException(status_code=404, detail="Situation not found")


@router.patch("/{situation_id}", response_model=Situation)
async def update_situation(
    situation_id: str,
    body: SituationUpdate,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    situations = store.load_situations()
    for s in situations:
        if s.id == situation_id:
            updates = body.model_dump(exclude_none=True)
            for key, value in updates.items():
                setattr(s, key, value)
            s.updated = datetime.now(UTC)
            store.save_situation(s)
            return s
    raise HTTPException(status_code=404, detail="Situation not found")


@router.post("/{situation_id}/events", response_model=Situation)
async def link_events(
    situation_id: str,
    body: EventLink,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    situations = store.load_situations()
    for s in situations:
        if s.id == situation_id:
            for eid in body.event_ids:
                if eid not in s.events:
                    s.events.append(eid)
            s.updated = datetime.now(UTC)
            store.save_situation(s)
            return s
    raise HTTPException(status_code=404, detail="Situation not found")
