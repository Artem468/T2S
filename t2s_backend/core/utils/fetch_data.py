from sqlalchemy import text

from core.utils.db_connection import get_runtime_sessionmaker
from .to_json import jsonable_row


async def fetch_data(sql_query):
    sessionmaker = get_runtime_sessionmaker()
    async with sessionmaker() as session:
        result = await session.execute(text(sql_query))
        rows = result.mappings().all()
        return [jsonable_row(r) for r in rows]
