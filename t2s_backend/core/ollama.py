import re

import requests
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
    data = __process_request(prompt)
    raw = data.get("response", "")
    return extract_sql(raw)


def generate_description(sql: str) -> str:
    prompt = f"Объясни кратко и простым языком SQL запрос: {sql}"
    data = __process_request(prompt)
    raw = data.get("response", "")
    return extract_sql(raw)


def __process_request(prompt: str) -> dict:
    base = getattr(settings, "OLLAMA_BASE", "http://127.0.0.1:11434")
    model = getattr(settings, "OLLAMA_MODEL", "stable-code:3b")
    url = f"{base}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(
            url,
            json=payload,
            timeout=180
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        raise RuntimeError(f"Ollama HTTP {e.response.status_code}: {e.response.text}") from e
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Ollama недоступен ({base}): {e}") from e
