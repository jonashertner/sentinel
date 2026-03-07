import secrets
from functools import lru_cache

from fastapi import Header, HTTPException

from sentinel.config import settings
from sentinel.store import DataStore


@lru_cache
def get_store() -> DataStore:
    return DataStore(data_dir=settings.data_dir)


def get_postgres_store():
    """Yield a PostgresStore backed by an async session (for use as a FastAPI dependency)."""
    from sentinel.db.engine import SessionLocal
    from sentinel.db.repository import PostgresStore

    async def _dep():
        async with SessionLocal() as session:
            yield PostgresStore(session)

    return _dep


def require_write_access(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    """Protect mutating endpoints when SENTINEL_API_WRITE_KEY is configured."""
    if not settings.api_write_key:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, settings.api_write_key):
        raise HTTPException(status_code=401, detail="Unauthorized")
