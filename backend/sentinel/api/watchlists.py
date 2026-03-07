import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from sentinel.api.deps import get_store, require_write_access
from sentinel.audit import log_audit
from sentinel.store import DataStore

router = APIRouter()


class Watchlist(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str
    diseases: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    min_risk_score: float = 0.0
    one_health_tags: list[str] = Field(default_factory=list)


@router.get("", response_model=list[Watchlist])
async def list_watchlists(store: DataStore = Depends(get_store)):
    return [Watchlist.model_validate(item) for item in store.load_watchlists()]


@router.post("", response_model=Watchlist, status_code=201)
async def create_watchlist(
    body: Watchlist,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    watchlists = [Watchlist.model_validate(item) for item in store.load_watchlists()]
    by_id = {wl.id: wl for wl in watchlists}
    by_id[body.id] = body
    store.save_watchlists([wl.model_dump(mode="json") for wl in by_id.values()])
    log_audit("CREATE", "watchlist", body.id, new_value=body.model_dump(mode="json"))
    return body


@router.delete("/{watchlist_id}", status_code=204)
async def delete_watchlist(
    watchlist_id: str,
    store: DataStore = Depends(get_store),
    _auth: None = Depends(require_write_access),
):
    watchlists = [Watchlist.model_validate(item) for item in store.load_watchlists()]
    updated = [wl for wl in watchlists if wl.id != watchlist_id]
    if len(updated) == len(watchlists):
        raise HTTPException(status_code=404, detail="Watchlist not found")
    log_audit("DELETE", "watchlist", watchlist_id)
    store.save_watchlists([wl.model_dump(mode="json") for wl in updated])
