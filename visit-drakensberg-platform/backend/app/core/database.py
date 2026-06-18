from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from supabase import create_client, Client
from upstash_redis import Redis
from typing import AsyncGenerator

from app.core.config import settings


# SQLAlchemy async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT != "production",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# Upstash Redis client
redis = Redis.from_env() if not settings.REDIS_URL else Redis(
    url=settings.REDIS_URL.split("?")[0] if "?" in settings.REDIS_URL else settings.REDIS_URL,
    token=settings.REDIS_URL.split("token=")[1] if "token=" in settings.REDIS_URL else "",
)
