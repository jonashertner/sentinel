from abc import ABC, abstractmethod

from sentinel.models.event import HealthEvent


class CollectorSkipped(RuntimeError):
    """Raised when a collector is intentionally skipped due to source constraints."""


class BaseCollector(ABC):
    """Abstract base class for all data source collectors."""

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the source identifier."""

    @abstractmethod
    async def collect(self) -> list[HealthEvent]:
        """Fetch and return new health events from this source."""
