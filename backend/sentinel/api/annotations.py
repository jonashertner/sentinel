from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from sentinel.api.deps import get_store, require_write_access
from sentinel.models.annotation import Annotation, AnnotationType, EventStatus, Visibility
from sentinel.models.event import (
    EscalationLevel,
    OperationalPriority,
    PlaybookType,
    VerificationStatus,
)
from sentinel.store import DataStore

router = APIRouter()


class AnnotationCreate(BaseModel):
    event_id: str
    author: str
    type: AnnotationType
    content: str
    visibility: Visibility = Visibility.INTERNAL
    risk_override: float | None = Field(default=None, ge=0.0, le=10.0)
    status_change: EventStatus | None = None
    linked_event_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    verification_override: VerificationStatus | None = None
    operational_priority_override: OperationalPriority | None = None
    playbook_override: PlaybookType | None = None
    playbook_sla_override_hours: int | None = Field(default=None, ge=1, le=720)
    escalation_level_override: EscalationLevel | None = None
    override_reason: str = ""


@router.post("", response_model=Annotation, status_code=201)
async def create_annotation(
    body: AnnotationCreate,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    if body.event_id not in {event.id for event in store.load_all_events()}:
        raise HTTPException(status_code=404, detail="Event not found")

    annotation = Annotation(**body.model_dump())
    try:
        store.save_annotation(annotation)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return annotation


@router.get("", response_model=list[Annotation])
async def list_annotations(
    event_id: str | None = None,
    store: DataStore = Depends(get_store),
):
    annotations = store.load_annotations()
    if event_id:
        annotations = [a for a in annotations if a.event_id == event_id]
    return annotations
