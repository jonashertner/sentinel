"""Seed PostgreSQL database from existing JSON data files."""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from sentinel.config import settings
from sentinel.db.engine import SessionLocal
from sentinel.db.repository import PostgresStore
from sentinel.store import DataStore


async def seed_from_json(data_dir: str | None = None) -> dict:
    """Read all data from JSON files and insert into PostgreSQL.

    Returns a summary dict with counts of seeded entities.
    """
    file_store = DataStore(data_dir=data_dir or settings.data_dir)

    async with SessionLocal() as session:
        pg_store = PostgresStore(session)

        # Seed events (by date)
        total_events = 0
        all_events = file_store.load_all_events()
        # Group by date_collected
        by_date: dict = {}
        for e in all_events:
            by_date.setdefault(e.date_collected, []).append(e)
        for day, events in sorted(by_date.items()):
            await pg_store.save_events(day, events)
            total_events += len(events)

        # Seed annotations
        annotations = file_store.load_annotations()
        for ann in annotations:
            await pg_store.save_annotation(ann)

        # Seed situations
        situations = file_store.load_situations()
        for sit in situations:
            await pg_store.save_situation(sit)

        # Seed reports
        from datetime import date as date_type
        from pathlib import Path

        reports_dir = Path(data_dir or settings.data_dir) / "reports"
        report_count = 0
        if reports_dir.exists():
            for path in sorted(reports_dir.glob("*-daily.md")):
                day_str = path.stem.replace("-daily", "")
                day = date_type.fromisoformat(day_str)
                content = path.read_text()
                await pg_store.save_report(day, content)
                report_count += 1

    return {
        "events": total_events,
        "annotations": len(annotations),
        "situations": len(situations),
        "reports": report_count,
    }


async def create_tables() -> None:
    """Create all tables using the migration SQL."""
    engine = create_async_engine(settings.database_url)
    migration_path = (
        __import__("pathlib").Path(__file__).parent / "migrations" / "001_initial.sql"
    )
    sql = migration_path.read_text()
    async with engine.begin() as conn:
        # Execute each statement separately (asyncpg doesn't support multi-statement)
        for statement in sql.split(";"):
            statement = statement.strip()
            if statement and not statement.startswith("--"):
                await conn.execute(text(statement))
    await engine.dispose()


async def main():
    """CLI entry point: create tables and seed data."""
    print("Creating tables...")
    await create_tables()
    print("Seeding data from JSON files...")
    result = await seed_from_json()
    print(f"Seeded: {result}")


if __name__ == "__main__":
    asyncio.run(main())
