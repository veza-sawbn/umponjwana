import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ---------------------------------------------------------------------------
# Alembic Config object
# ---------------------------------------------------------------------------
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Import all models so Alembic's autogenerate can detect them.
# ---------------------------------------------------------------------------
from app.core.database import Base  # noqa: F401, E402

# Import every model module so their tables are registered on Base.metadata
import app.models.user          # noqa: F401
import app.models.supplier      # noqa: F401
import app.models.listing       # noqa: F401
import app.models.booking       # noqa: F401
import app.models.payment       # noqa: F401
import app.models.review        # noqa: F401
import app.models.notification  # noqa: F401

target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# DATABASE_URL override: prefer env var over alembic.ini so the ini never
# contains a hard-coded secret.
# ---------------------------------------------------------------------------
database_url = os.getenv("DATABASE_URL")
if database_url:
    # asyncpg driver is required for async SQLAlchemy
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    config.set_main_option("sqlalchemy.url", database_url)
else:
    # Fall back to whatever is in alembic.ini (%(DATABASE_URL)s)
    url_from_ini = config.get_main_option("sqlalchemy.url", "")
    if url_from_ini.startswith("postgresql://"):
        config.set_main_option(
            "sqlalchemy.url",
            url_from_ini.replace("postgresql://", "postgresql+asyncpg://", 1),
        )
    elif url_from_ini.startswith("postgres://"):
        config.set_main_option(
            "sqlalchemy.url",
            url_from_ini.replace("postgres://", "postgresql+asyncpg://", 1),
        )


# ---------------------------------------------------------------------------
# Offline migrations (emit SQL to stdout, no live DB connection)
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online migrations (async, connects to the live database)
# ---------------------------------------------------------------------------
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
