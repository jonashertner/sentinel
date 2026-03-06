from functools import lru_cache

from sentinel.config import settings
from sentinel.store import DataStore


@lru_cache
def get_store() -> DataStore:
    return DataStore(data_dir=settings.data_dir)
