import re

from django.conf import settings
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

from core.utils import normalize_llm_sql


def _build_sql_prompt(question: str) -> str:
    return (
        "Ты генератор одного исполняемого запроса SQLite 3. Ответ — ТОЛЬКО текст SQL, одна инструкция, "
        "без markdown, без ```, без комментариев «--», без преамбулы «Вот запрос», без второго запроса после «;».\n\n"
        "Обязательно:\n"
        "• Только SELECT или WITH … SELECT. Не INSERT/UPDATE/DELETE/PRAGMA/ATTACH.\n"
        "• Ровно одна завершающая «;» в конце. Внутри строк в одинарных кавычках не используй «;».\n"
        "• Скобки сбалансированы: после COUNT( … ), SUM( … ), AVG( … ) одна закрывающая «)»; "
        "для COUNT(DISTINCT x) шаблон ровно «COUNT(DISTINCT x)», без «))» перед FROM/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT.\n"
        "• Нет лишней запятой перед FROM/WHERE/GROUP BY (ошибка «near FROM»).\n"
        "• Имена таблиц и колонок только из схемы ниже; не выдумывай таблицы и поля.\n"
        "• Предпочитай явные JOIN (INNER JOIN … ON …), избегай лишних декартовых «FROM a, b» без условия.\n"
        "• Если по смыслу данных в схеме нет или запрос невыразим — верни ровно: SELECT 1 WHERE 0;\n\n"
        "Как результат попадёт в интерфейс (учитывай при выборе столбцов):\n"
        "• Каждая строка результата — строка таблицы на экране; имена столбцов — заголовки. Давай понятные алиасы (AS city_name, AS orders_cnt, AS revenue …).\n"
        "• График строится по первому столбцу, где у всех строк есть числовое значение (число или строка-число). "
        "Для осмысленной диаграммы по суммам/количествам добавь такой столбец; по возможности дай несколько строк с группировкой "
        "(например SELECT c.name AS label, SUM(o.price_order_local) AS value … GROUP BY c.city_id ORDER BY value DESC LIMIT 20), "
        "а не одну безликую агрегатную строку без подписей, если вопрос про сравнение или рейтинг.\n"
        "• Если вопрос не требует всех строк, ограничь выборку LIMIT с разумным верхом (например до 200–500 строк), чтобы таблица и график оставались читаемыми.\n\n"
        "Подсказки по данным:\n"
        "• cities: city_id, name. orders: order_id, city_id, user_id, … tenders: tender_id, order_id, …\n"
        "• Связь заказ–город: orders.city_id = cities.city_id. Связь тендер–заказ: tenders.order_id = orders.order_id.\n"
        "• Время: строки в формате ISO; разница секунд: (julianday(t2) - julianday(t1)) * 86400.\n\n"
        "Схема (единственный источник колонок):\n"
        "CREATE TABLE IF NOT EXISTS cities (\n"
        "  city_id INTEGER PRIMARY KEY,\n"
        "  name TEXT\n"
        ");\n"
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
        f"Вопрос пользователя:\n{question}\n\nОтвет (только SQL, одна инструкция):"
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
    c = sql.find(";")
    if c != -1 and c < len(sql) - 1:
        tail = sql[c + 1 :].strip()
        if tail and not tail.startswith("--"):
            sql = sql[: c + 1].strip()
    if not sql.rstrip().endswith(";"):
        sql = sql.rstrip() + ";"
    return sql


def _extract_plain_description(raw: str) -> str:
    """Текст объяснения SQL без extract_sql (тот вырезал бы SELECT и «ронял» смысл)."""
    text = (raw or "").strip()
    if not text:
        return ""
    m = re.search(r"```(?:\w+)?\s*([\s\S]*?)```", text)
    if m:
        inner = m.group(1).strip()
        low = inner.lower()
        if low.startswith("select") or low.startswith("with "):
            text = (text[: m.start()] + text[m.end() :]).strip()
        else:
            return inner[:4000]
    text = re.sub(r"\s+", " ", text).strip()
    return text[:4000]


def generate_sql(question: str) -> str:
    prompt = _build_sql_prompt(question)
    data = __process_request(prompt)
    return normalize_llm_sql(extract_sql(data))


def generate_description(sql: str, user_question: str = "") -> str:
    q = (user_question or "").strip()
    q_block = (
        f"Исходный вопрос пользователя (объяснение должно отвечать ИМЕННО на него, а не про SQL вообще):\n«{q}»\n\n"
        if q
        else "Вопрос пользователя не передан — опиши только смысл SQL ниже.\n\n"
    )
    prompt = (
        "Ты редактор отчёта на русском языке. Твоя задача — в связной речи объяснить: "
        "как приведённый ниже SQL связан с вопросом пользователя и что именно увидит человек в таблице результата.\n\n"
        "ОБЯЗАТЕЛЬНО: опирайся на формулировку вопроса (слова «случайный», «10», «пользователи» и т.д.) и на таблицы/поля в SQL. "
        "Пиши так, будто отвечаешь автору вопроса, а не учишь SQL с нуля.\n\n"
        "КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО (такой текст — провальный ответ, не пиши его вообще):\n"
        "— перечисление «ключевых слов» SQL (SELECT, WHERE, FROM, AND, LIKE, DISTINCT…);\n"
        "— фразы вроде «в SQL вам нужно понять», «работать с базой данных вам нужно знать», «на данный момент», «запросы:»;\n"
        "— общий курс SQL, не связанный с этим запросом и этим вопросом;\n"
        "— дословное повторение всего SQL; куски SQL можно упомянуть одним коротким оборотом при необходимости.\n\n"
        "ЖЁСТКИЙ ЛИМИТ: не больше четырёх коротких предложений, не больше 450 символов, один абзац.\n\n"
        "Запрещено также: нумерация 1. 2); маркеры списка; markdown и ```; ссылки; английские абзацы.\n\n"
        f"{q_block}"
        f"SQL:\n{sql}\n\n"
        "Ответ (только русский текст, только про этот вопрос и этот запрос):"
    )
    data = __process_request(prompt)
    out = _extract_plain_description(data)
    return out if out else "Краткое описание запроса."


def __process_request(prompt: str) -> str | None:
    url = "https://foundation-models.api.cloud.ru/v1"

    client = OpenAI(
        api_key=settings.AI_API_KEY,
        base_url=url
    )

    messages: list[ChatCompletionMessageParam] = [
        {
            "role": "user",
            "content": prompt
        }
    ]

    response = client.chat.completions.create(
        model="Qwen/Qwen3-Coder-Next",
        max_tokens=2500,
        temperature=0.5,
        presence_penalty=0,
        top_p=0.95,
        messages=messages
    )

    return response.choices[0].message.content