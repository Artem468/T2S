import re

from asgiref.sync import sync_to_async
from django.conf import settings
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

from core.utils.db_inspector import schema_to_string


def _build_sql_prompt(question: str) -> str:
    # Предполагается, что schema_to_string выдает чистый DDL (CREATE TABLE...)
    schema = sync_to_async(schema_to_string)(settings.INSPECTOR.get_full_schema())

    return """
    Ты — узкоспециализированный генератор SQL для SQLite 3. Твоя задача: перевести вопрос в один запрос, используя ТОЛЬКО предоставленную схему.

    ### СТРОГИЕ ОГРАНИЧЕНИЯ (REJECTION CRITERIA):
    1. ИСПОЛЬЗУЙ ТОЛЬКО ТАБЛИЦЫ И КОЛОНКИ, УКАЗАННЫЕ В СЕКЦИИ "СХЕМА".
    2. ЕСЛИ В СХЕМЕ НЕТ НУЖНОГО ПОЛЯ: Не пытайся угадать или заменить его на похожее (например, если нет 'user_id', не используй 'id' и наоборот). В этом случае верни: SELECT 1 WHERE 0;
    3. НИКАКИХ ГАЛЛЮЦИНАЦИЙ: Если вопрос пользователя подразумевает данные, которых нет в таблицах — не выдумывай их.
    4. ФОРМАТ ОТВЕТА: Только чистый текст SQL. Без кавычек ```, без пояснений, без комментариев.

    ### ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ:
    • Один SELECT запрос, заканчивающийся на «;».
    • Для связи таблиц используй FOREIGN KEY из схемы. Делай явные INNER/LEFT JOIN.
    • КАЖДОМУ столбцу дай осмысленный русский алиас в двойных кавычках: AS "Название".
    • Для числовых данных (деньги, метры) указывай единицы в алиасе: AS "Сумма, руб.".
    • Округляй денежные значения: ROUND(col, 2).
    • Лимит выдачи: LIMIT 500, если в вопросе не указано иное.

    ### СПЕЦИФИКА SQLITE:
    • Даты: используй date(), datetime(), strftime().
    • Разница во времени (секунды): (julianday(t2) - julianday(t1)) * 86400.
    • Типы: учитывай, что BOOLEAN в SQLite — это 0 или 1.

    ### СХЕМА БАЗЫ ДАННЫХ (ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ):
    {schema}

    ### ЗАДАЧА:
    Вопрос: {question}
    Сгенерируй SQL, используя только вышеуказанные названия колонок и таблиц. Если колонки нет в схеме — не выполняй запрос.

    Ответ:""".format(schema=schema, question=question)


def _extract_plain_description(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    m = re.search(r"```(?:\w+)?\s*([\s\S]*?)```", text)
    if m:
        inner = m.group(1).strip()
        low = inner.lower()
        if low.startswith("select") or low.startswith("with "):
            text = (text[: m.start()] + text[m.end():]).strip()
        else:
            return inner[:4000]
    text = re.sub(r"\s+", " ", text).strip()
    return text[:4000]


def generate_sql(question: str) -> str:
    prompt = _build_sql_prompt(question)
    data = __process_request(prompt)
    return data


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
