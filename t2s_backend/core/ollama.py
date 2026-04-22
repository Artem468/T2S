import json
import re
import urllib.error
import urllib.request

from django.conf import settings


def _build_sql_prompt(question: str) -> str:
    return (
        "Ты аналитик SQLite. Верни ровно один SQL-запрос, без пояснений и без markdown.\n\n"
        "Правила:\n"
        "1. Таблицы: cities (city_id, name), orders, tenders.\n"
        "2. Город: JOIN cities c ON o.city_id = c.city_id.\n"
        "3. Количество заказов: COUNT(o.order_id); сумма: SUM(o.price_order_local).\n"
        "4. Разница времени в секундах: (julianday(t2) - julianday(t1)) * 86400.\n"
        "5. Если данных в схеме нет — одна строка: SELECT 1 WHERE 0;\n\n"
        "CREATE TABLE IF NOT EXISTS orders (\n"
        "  order_id TEXT PRIMARY KEY, city_id INTEGER, user_id TEXT, driver_id TEXT,\n"
        "  status_order TEXT, order_timestamp TEXT, order_modified_local TEXT,\n"
        "  distance_in_meters INTEGER, duration_in_seconds INTEGER,\n"
        "  price_order_local REAL, price_start_local REAL\n"
        ");\n"
        "CREATE TABLE IF NOT EXISTS tenders (\n"
        "  tender_id TEXT PRIMARY KEY, order_id TEXT, status_tender TEXT,\n"
        "  tender_timestamp TEXT, driveraccept_timestamp TEXT, driverarrived_timestamp TEXT,\n"
        "  driverstarttheride_timestamp TEXT, driverdone_timestamp TEXT,\n"
        "  clientcancel_timestamp TEXT, drivercancel_timestamp TEXT,\n"
        "  cancel_before_accept_local TEXT, price_tender_local REAL, offset_hours INTEGER,\n"
        "  FOREIGN KEY (order_id) REFERENCES orders (order_id)\n"
        ");\n\n"
        f"Вопрос: {question}\n\nSQL:"
    )


def extract_sql(raw: str) -> str:
    text = (raw or "").strip()
    fence = re.search(r"```(?:sql)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    low = text.lower()
    pos = -1
    for key in ("select", "with"):
        i = low.find(key)
        if i != -1 and (pos == -1 or i < pos):
            pos = i
    if pos == -1:
        return "SELECT 1 WHERE 0;"
    sql = text[pos:].strip()
    if "\n\n" in sql:
        sql = sql.split("\n\n")[0].strip()
    if not sql.rstrip().endswith(";"):
        sql = sql.rstrip() + ";"
    return sql


def generate_sql(question: str) -> str:
    prompt = _build_sql_prompt(question)
    base = getattr(settings, "OLLAMA_BASE", "http://127.0.0.1:11434").rstrip("/")
    model = getattr(settings, "OLLAMA_MODEL", "stable-code:3b")
    url = f"{base}/api/generate"
    payload = json.dumps(
        {"model": model, "prompt": prompt, "stream": False},
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Ollama HTTP {e.code}: {body}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Ollama недоступен ({base}): {e.reason}") from e
    raw = (data or {}).get("response", "")
    return extract_sql(raw)
