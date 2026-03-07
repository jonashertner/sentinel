"""PostgreSQL-backed repository implementing the same interface as DataStore."""

from datetime import date, datetime

from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel.db.tables import annotations as ann_table
from sentinel.db.tables import audit_log as audit_table
from sentinel.db.tables import collector_runs as cr_table
from sentinel.db.tables import events as ev_table
from sentinel.db.tables import reports as rep_table
from sentinel.db.tables import situations as sit_table
from sentinel.db.tables import watchlists as wl_table
from sentinel.models.annotation import Annotation
from sentinel.models.event import HealthEvent
from sentinel.models.situation import Situation
from sentinel.pipeline import CollectorStatus


class PostgresStore:
    """Async PostgreSQL store — drop-in replacement for the file-based DataStore."""

    def __init__(self, session: AsyncSession):
        self._s = session

    # -- Events ----------------------------------------------------------------

    async def save_events(self, day: date, events: list[HealthEvent]) -> None:
        if not events:
            return
        rows = [_event_to_row(e) for e in events]
        stmt = pg_insert(ev_table).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["id", "date_collected"],
            set_={
                c.name: stmt.excluded[c.name]
                for c in ev_table.columns
                if c.name not in ("id", "date_collected")
            },
        )
        await self._s.execute(stmt)
        await self._s.commit()

    async def load_events(self, day: date) -> list[HealthEvent]:
        result = await self._s.execute(
            select(ev_table).where(ev_table.c.date_collected == day)
        )
        return [_row_to_event(r) for r in result.mappings()]

    async def load_all_events(self) -> list[HealthEvent]:
        result = await self._s.execute(select(ev_table).order_by(ev_table.c.date_collected))
        return [_row_to_event(r) for r in result.mappings()]

    # -- Annotations -----------------------------------------------------------

    async def save_annotation(self, annotation: Annotation) -> None:
        row = _annotation_to_row(annotation)
        stmt = pg_insert(ann_table).values(row)
        stmt = stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={c.name: stmt.excluded[c.name] for c in ann_table.columns if c.name != "id"},
        )
        await self._s.execute(stmt)
        await self._s.commit()

    async def load_annotations(self, event_id: str | None = None) -> list[Annotation]:
        stmt = select(ann_table)
        if event_id:
            stmt = stmt.where(ann_table.c.event_id == event_id)
        result = await self._s.execute(stmt.order_by(ann_table.c.timestamp))
        return [_row_to_annotation(r) for r in result.mappings()]

    # -- Situations ------------------------------------------------------------

    async def save_situation(self, situation: Situation) -> None:
        row = _situation_to_row(situation)
        stmt = pg_insert(sit_table).values(row)
        stmt = stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={c.name: stmt.excluded[c.name] for c in sit_table.columns if c.name != "id"},
        )
        await self._s.execute(stmt)
        await self._s.commit()

    async def load_situations(self) -> list[Situation]:
        result = await self._s.execute(select(sit_table).order_by(sit_table.c.updated.desc()))
        return [_row_to_situation(r) for r in result.mappings()]

    # -- Watchlists ------------------------------------------------------------

    async def save_watchlist(self, wl: dict) -> None:
        stmt = pg_insert(wl_table).values(wl)
        stmt = stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={c.name: stmt.excluded[c.name] for c in wl_table.columns if c.name != "id"},
        )
        await self._s.execute(stmt)
        await self._s.commit()

    async def load_watchlists(self) -> list[dict]:
        result = await self._s.execute(select(wl_table))
        return [dict(r) for r in result.mappings()]

    async def delete_watchlist(self, wl_id: str) -> bool:
        result = await self._s.execute(delete(wl_table).where(wl_table.c.id == wl_id))
        await self._s.commit()
        return result.rowcount > 0

    # -- Reports ---------------------------------------------------------------

    async def save_report(self, day: date, content: str) -> None:
        stmt = pg_insert(rep_table).values(day=day, content=content)
        stmt = stmt.on_conflict_do_update(
            index_elements=["day"],
            set_={"content": stmt.excluded.content},
        )
        await self._s.execute(stmt)
        await self._s.commit()

    async def load_report(self, day: date) -> str:
        result = await self._s.execute(
            select(rep_table.c.content).where(rep_table.c.day == day)
        )
        row = result.scalar_one_or_none()
        return row or ""

    # -- Collector Runs --------------------------------------------------------

    async def save_collector_run(self, status: CollectorStatus, started_at: datetime) -> None:
        await self._s.execute(
            cr_table.insert().values(
                source=status.source,
                started_at=started_at,
                finished_at=datetime.utcnow(),
                event_count=status.event_count,
                ok=status.ok,
                error=status.error,
                latency_seconds=status.latency_seconds,
            )
        )
        await self._s.commit()

    # -- Audit Log -------------------------------------------------------------

    async def log_action(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        old_value: dict | None = None,
        new_value: dict | None = None,
    ) -> None:
        await self._s.execute(
            audit_table.insert().values(
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                old_value=old_value,
                new_value=new_value,
            )
        )
        await self._s.commit()

    # -- Manifest --------------------------------------------------------------

    async def get_manifest(self) -> dict:
        ev_dates = await self._s.execute(
            text("SELECT DISTINCT date_collected FROM events ORDER BY date_collected")
        )
        sit_ids = await self._s.execute(text("SELECT id FROM situations ORDER BY id"))
        rep_days = await self._s.execute(text("SELECT day FROM reports ORDER BY day"))
        total = await self._s.execute(text("SELECT count(*) FROM events"))
        latest = await self._s.execute(
            text("SELECT MAX(date_collected) FROM events")
        )

        return {
            "event_dates": [str(r[0]) for r in ev_dates],
            "situation_ids": [r[0] for r in sit_ids],
            "report_dates": [str(r[0]) for r in rep_days],
            "total_events": total.scalar() or 0,
            "latest_collection": str(latest.scalar() or ""),
        }


# -- Row conversion helpers ----------------------------------------------------


def _event_to_row(e: HealthEvent) -> dict:
    d = e.model_dump(mode="json")
    # Remove computed field (risk_category) — not stored, recomputed on load
    d.pop("risk_category", None)
    return d


def _row_to_event(row) -> HealthEvent:
    d = dict(row)
    return HealthEvent.model_validate(d)


def _annotation_to_row(a: Annotation) -> dict:
    return a.model_dump(mode="json")


def _row_to_annotation(row) -> Annotation:
    return Annotation.model_validate(dict(row))


def _situation_to_row(s: Situation) -> dict:
    d = s.model_dump(mode="json")
    # annotations are stored as JSON array
    return d


def _row_to_situation(row) -> Situation:
    return Situation.model_validate(dict(row))
