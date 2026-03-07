"""Async SQLAlchemy engine and session factory for PostgreSQL."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from sentinel.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    echo=settings.log_level == "DEBUG",
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session():
    async with SessionLocal() as session:
        yield session
