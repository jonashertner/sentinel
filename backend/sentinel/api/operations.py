import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from sentinel.api.deps import get_store, require_write_access
from sentinel.audit import log_audit
from sentinel.projection import deduplicate_by_latest, load_projected_events
from sentinel.store import DataStore

router = APIRouter()

TriageStatus = Literal["MONITOR", "ESCALATE", "DISMISS"]


class EventOpsState(BaseModel):
    event_id: str
    triage_status: TriageStatus | None = None
    note: str = ""
    updated_by: str = "analyst@bag.ch"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class EventOpsUpdate(BaseModel):
    triage_status: TriageStatus | None = None
    note: str = ""
    updated_by: str = "analyst@bag.ch"


class SituationNote(BaseModel):
    id: str = Field(default_factory=lambda: f"sitnote-{uuid.uuid4().hex[:10]}")
    author: str
    content: str = Field(min_length=1, max_length=4000)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class SituationNoteCreate(BaseModel):
    author: str
    content: str = Field(min_length=1, max_length=4000)


class SituationActionsUpdate(BaseModel):
    checked_action_indices: list[int] = Field(default_factory=list)
    updated_by: str = "analyst@bag.ch"


class SituationOpsState(BaseModel):
    situation_id: str
    annotations: list[SituationNote] = Field(default_factory=list)
    checked_action_indices: list[int] = Field(default_factory=list)
    updated_by: str = "analyst@bag.ch"
    updated_at: datetime | None = None


def _require_event(store: DataStore, event_id: str) -> None:
    valid_ids = {event.id for event in deduplicate_by_latest(load_projected_events(store))}
    if event_id not in valid_ids:
        raise HTTPException(status_code=404, detail="Event not found")


def _require_situation(store: DataStore, situation_id: str) -> None:
    if situation_id not in {s.id for s in store.load_situations()}:
        raise HTTPException(status_code=404, detail="Situation not found")


def _get_event_state(store: DataStore, event_id: str) -> EventOpsState:
    state = store.load_ops_state()
    raw = state.get("event_triage", {}).get(event_id, {})
    if isinstance(raw, dict):
        try:
            return EventOpsState.model_validate(raw)
        except Exception:
            pass
    return EventOpsState(event_id=event_id)


def _get_situation_state(store: DataStore, situation_id: str) -> SituationOpsState:
    state = store.load_ops_state()
    raw_notes = state.get("situation_notes", {}).get(situation_id, [])
    notes: list[SituationNote] = []
    if isinstance(raw_notes, list):
        for note in raw_notes:
            if not isinstance(note, dict):
                continue
            try:
                notes.append(SituationNote.model_validate(note))
            except Exception:
                continue

    raw_actions = state.get("situation_actions", {}).get(situation_id, {})
    checked_action_indices: list[int] = []
    updated_by = "analyst@bag.ch"
    updated_at: datetime | None = None
    if isinstance(raw_actions, dict):
        checked = raw_actions.get("checked_action_indices", [])
        if isinstance(checked, list):
            checked_action_indices = sorted(
                {
                    int(i)
                    for i in checked
                    if isinstance(i, int) and i >= 0
                }
            )
        updated_by = str(raw_actions.get("updated_by") or updated_by)
        raw_updated = raw_actions.get("updated_at")
        if isinstance(raw_updated, str):
            try:
                updated_at = datetime.fromisoformat(raw_updated.replace("Z", "+00:00"))
            except Exception:
                updated_at = None

    if notes:
        latest_note = max(note.timestamp for note in notes)
        if updated_at is None or latest_note > updated_at:
            updated_at = latest_note

    return SituationOpsState(
        situation_id=situation_id,
        annotations=notes,
        checked_action_indices=checked_action_indices,
        updated_by=updated_by,
        updated_at=updated_at,
    )


@router.get("/events/{event_id}", response_model=EventOpsState)
async def get_event_state(event_id: str, store: DataStore = Depends(get_store)):
    _require_event(store, event_id)
    return _get_event_state(store, event_id)


@router.put("/events/{event_id}", response_model=EventOpsState)
async def update_event_state(
    event_id: str,
    body: EventOpsUpdate,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    _require_event(store, event_id)
    state = store.load_ops_state()
    event_state = EventOpsState(
        event_id=event_id,
        triage_status=body.triage_status,
        note=body.note.strip(),
        updated_by=body.updated_by.strip() or "analyst@bag.ch",
        updated_at=datetime.now(UTC),
    )
    state.setdefault("event_triage", {})[event_id] = event_state.model_dump(mode="json")
    store.save_ops_state(state)
    log_audit(
        "UPDATE",
        "event_ops",
        event_id,
        new_value=event_state.model_dump(mode="json"),
    )
    return event_state


@router.get("/situations/{situation_id}", response_model=SituationOpsState)
async def get_situation_state(situation_id: str, store: DataStore = Depends(get_store)):
    _require_situation(store, situation_id)
    return _get_situation_state(store, situation_id)


@router.post("/situations/{situation_id}/annotations", response_model=SituationOpsState)
async def add_situation_note(
    situation_id: str,
    body: SituationNoteCreate,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    _require_situation(store, situation_id)
    note = SituationNote(author=body.author.strip() or "analyst@bag.ch", content=body.content.strip())
    state = store.load_ops_state()
    notes = state.setdefault("situation_notes", {}).setdefault(situation_id, [])
    if not isinstance(notes, list):
        notes = []
        state["situation_notes"][situation_id] = notes
    notes.append(note.model_dump(mode="json"))
    store.save_ops_state(state)
    log_audit(
        "CREATE",
        "situation_note",
        note.id,
        new_value={"situation_id": situation_id, **note.model_dump(mode="json")},
    )
    return _get_situation_state(store, situation_id)


@router.put("/situations/{situation_id}/actions", response_model=SituationOpsState)
async def update_situation_actions(
    situation_id: str,
    body: SituationActionsUpdate,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    _require_situation(store, situation_id)
    checked = sorted({idx for idx in body.checked_action_indices if idx >= 0})
    state = store.load_ops_state()
    state.setdefault("situation_actions", {})[situation_id] = {
        "checked_action_indices": checked,
        "updated_by": body.updated_by.strip() or "analyst@bag.ch",
        "updated_at": datetime.now(UTC).isoformat(),
    }
    store.save_ops_state(state)
    log_audit(
        "UPDATE",
        "situation_actions",
        situation_id,
        new_value={"checked_action_indices": checked},
    )
    return _get_situation_state(store, situation_id)
