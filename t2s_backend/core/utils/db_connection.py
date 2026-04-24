import asyncio
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

from django.conf import settings
from django.core.cache import cache
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from core.models import DatabaseConnection, DatabaseType
from core.utils.db_inspector import DatabaseInspector

_runtime_cache: dict[str, Any] = {}
ACTIVE_CONNECTION_CACHE_KEY = "t2s_active_connection_payload"


def _resolve_sqlite_file(path: str) -> str:
    sqlite_path = Path(path)
    if not sqlite_path.is_absolute():
        sqlite_path = Path(settings.BASE_DIR) / sqlite_path
    return sqlite_path.resolve().as_posix()


def build_async_database_url(
    db_type: str,
    username: str = "",
    password: str = "",
    database_name: str = "",
    host: str = "",
    port: int | None = None,
    sqlite_file_path: str = "",
) -> str:
    if db_type == DatabaseType.POSTGRESQL:
        encoded_user = quote_plus(username)
        encoded_password = quote_plus(password)
        return f"postgresql+asyncpg://{encoded_user}:{encoded_password}@{host}:{port or 5432}/{database_name}"

    if db_type == DatabaseType.MYSQL:
        encoded_user = quote_plus(username)
        encoded_password = quote_plus(password)
        return f"mysql+aiomysql://{encoded_user}:{encoded_password}@{host}:{port or 3306}/{database_name}"

    resolved_sqlite_path = _resolve_sqlite_file(sqlite_file_path)
    return f"sqlite+aiosqlite:///{resolved_sqlite_path}"


def _runtime_key(data: dict[str, Any]) -> str:
    return "|".join(
        [
            str(data.get("db_type", "sqlite")),
            str(data.get("username", "")),
            str(data.get("password", "")),
            str(data.get("database_name", "")),
            str(data.get("host", "")),
            str(data.get("port", "")),
            str(data.get("sqlite_file_path", "")),
        ]
    )


def get_active_connection_payload() -> dict[str, Any] | None:
    payload = cache.get(ACTIVE_CONNECTION_CACHE_KEY)
    if payload:
        return payload

    try:
        loop = asyncio.get_running_loop()
        in_async_context = loop.is_running()
    except RuntimeError:
        in_async_context = False

    if not in_async_context:
        connection = (
            DatabaseConnection.objects.filter(is_active=True)
            .order_by("-updated_at")
            .first()
        )
        if connection:
            payload = {
                "db_type": connection.db_type,
                "username": connection.username,
                "password": connection.password,
                "database_name": connection.database_name,
                "host": connection.host,
                "port": connection.port,
                "sqlite_file_path": connection.sqlite_file.path if connection.sqlite_file else "",
            }
            set_active_connection_payload(payload)
            return payload

    return {
        "db_type": DatabaseType.SQLITE,
        "sqlite_file_path": "incity.db",
    }


def set_active_connection_payload(payload: dict[str, Any]) -> None:
    cache.set(ACTIVE_CONNECTION_CACHE_KEY, payload, timeout=None)


def get_runtime_bundle() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession], DatabaseInspector, str]:
    payload = get_active_connection_payload()
    key = _runtime_key(payload)

    if _runtime_cache.get("key") == key:
        return (
            _runtime_cache["engine"],
            _runtime_cache["sessionmaker"],
            _runtime_cache["inspector"],
            payload["db_type"],
        )

    url = build_async_database_url(**payload)
    engine = create_async_engine(url)
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    inspector = DatabaseInspector(engine)

    _runtime_cache["key"] = key
    _runtime_cache["engine"] = engine
    _runtime_cache["sessionmaker"] = sessionmaker
    _runtime_cache["inspector"] = inspector

    return engine, sessionmaker, inspector, payload["db_type"]


def get_runtime_sessionmaker() -> async_sessionmaker[AsyncSession]:
    _, sessionmaker, _, _ = get_runtime_bundle()
    return sessionmaker


def get_runtime_inspector() -> DatabaseInspector:
    _, _, inspector, _ = get_runtime_bundle()
    return inspector


def get_runtime_db_type() -> str:
    _, _, _, db_type = get_runtime_bundle()
    return db_type


async def check_connection(url: str) -> None:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    finally:
        await engine.dispose()
