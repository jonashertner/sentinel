from fastapi import APIRouter, Depends

from sentinel.api.deps import get_store
from sentinel.models.annotation import Annotation
from sentinel.store import DataStore

router = APIRouter()


@router.post("", response_model=Annotation, status_code=201)
async def create_annotation(body: Annotation, store: DataStore = Depends(get_store)):
    store.save_annotation(body)
    return body


@router.get("", response_model=list[Annotation])
async def list_annotations(
    event_id: str | None = None,
    store: DataStore = Depends(get_store),
):
    annotations = store.load_annotations()
    if event_id:
        annotations = [a for a in annotations if a.event_id == event_id]
    return annotations
