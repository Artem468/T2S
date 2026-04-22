from decimal import Decimal

from django.conf import settings
from sqlalchemy import text


def _jsonable_row(mapping):
    out = {}
    for key, val in dict(mapping).items():
        if isinstance(val, Decimal):
            out[key] = float(val)
        elif hasattr(val, "isoformat"):
            out[key] = val.isoformat()
        elif isinstance(val, bytes):
            out[key] = val.decode("utf-8", errors="replace")
        else:
            out[key] = val
    return out


async def fetch_data(sql_query):
    async with settings.ASYNC_SESSION() as session:
        result = await session.execute(text(sql_query))
        rows = result.mappings().all()
        return [_jsonable_row(r) for r in rows]