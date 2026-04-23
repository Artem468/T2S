import re
from decimal import Decimal

from django.conf import settings
from sqlalchemy import text


def normalize_llm_sql(sql: str) -> str:
    """
    Типичные опечатки LLM в SQLite: лишняя «)», лишняя запятая перед ключевыми словами.
    """
    s = (sql or "").strip()
    patterns = (
        (r"\)\)\s+FROM\b", ") FROM"),
        (r"\)\)\s+WHERE\b", ") WHERE"),
        (r"\)\)\s+GROUP\s+BY\b", ") GROUP BY"),
        (r"\)\)\s+HAVING\b", ") HAVING"),
        (r"\)\)\s+ORDER\s+BY\b", ") ORDER BY"),
        (r"\)\)\s+LIMIT\b", ") LIMIT"),
        # «SELECT a, FROM t» / лишняя запятая перед ключевым словом
        (r",\s+FROM\b", " FROM"),
        (r",\s+WHERE\b", " WHERE"),
        (r",\s+GROUP\s+BY\b", " GROUP BY"),
        (r",\s+HAVING\b", " HAVING"),
        (r",\s+ORDER\s+BY\b", " ORDER BY"),
        (r",\s+LIMIT\b", " LIMIT"),
    )
    changed = True
    while changed:
        changed = False
        for pat, repl in patterns:
            new_s = re.sub(pat, repl, s, flags=re.IGNORECASE, count=1)
            if new_s != s:
                s = new_s
                changed = True
    return s


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
    sql_query = normalize_llm_sql(sql_query)
    async with settings.ASYNC_SESSION() as session:
        result = await session.execute(text(sql_query))
        rows = result.mappings().all()
        return [_jsonable_row(r) for r in rows]