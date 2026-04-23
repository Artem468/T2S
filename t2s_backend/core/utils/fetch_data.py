from django.conf import settings
from sqlalchemy import text

from .to_json import jsonable_row


async def fetch_data(sql_query):
    async with settings.ASYNC_SESSION() as session:
        result = await session.execute(text(sql_query))
        rows = result.mappings().all()
        return [jsonable_row(r) for r in rows]