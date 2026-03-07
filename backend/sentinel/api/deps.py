import secrets
from collections.abc import AsyncGenerator
from functools import lru_cache

from fastapi import Header, HTTPException

from sentinel.config import settings
from sentinel.store import DataStore


@lru_cache
def _file_store() -> DataStore:
    return DataStore(data_dir=settings.data_dir)


def get_store() -> DataStore:
    """Return the file-based DataStore (synchronous, legacy)."""
    return _file_store()


async def get_pg_store() -> AsyncGenerator:
    """Yield a PostgresStore backed by an async session."""
    from sentinel.db.engine import SessionLocal
    from sentinel.db.repository import PostgresStore

    async with SessionLocal() as session:
        yield PostgresStore(session)


def require_write_access(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> None:
    """Protect mutating endpoints when SENTINEL_API_WRITE_KEY is configured."""
    if not settings.api_write_key:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, settings.api_write_key):
        raise HTTPException(status_code=401, detail="Unauthorized")
