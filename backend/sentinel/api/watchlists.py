import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# In-memory store for PoC
_watchlists: dict[str, "Watchlist"] = {}


class Watchlist(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str
    diseases: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    min_risk_score: float = 0.0
    one_health_tags: list[str] = Field(default_factory=list)


@router.get("", response_model=list[Watchlist])
async def list_watchlists():
    return list(_watchlists.values())


@router.post("", response_model=Watchlist, status_code=201)
async def create_watchlist(body: Watchlist):
    _watchlists[body.id] = body
    return body


@router.delete("/{watchlist_id}", status_code=204)
async def delete_watchlist(watchlist_id: str):
    if watchlist_id not in _watchlists:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    del _watchlists[watchlist_id]
