import re

from asgiref.sync import async_to_sync
from django.conf import settings
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

from core.models import DatabaseType
from core.utils.db_connection import get_runtime_db_type, get_runtime_inspector
from core.utils.db_inspector import schema_to_string


def _get_schema_ddl() -> str:
    inspector = get_runtime_inspector()
    raw_schema = async_to_sync(inspector.get_full_schema)()
    return schema_to_string(raw_schema)


def _build_sql_prompt(
        question: str,
        schema_ddl: str,
        db_type: str,
        previous_error: str | None = None,
        failed_sql: str | None = None,
) -> str:
    retry_block = ""
    if previous_error:
        retry_block = (
            "\nPREVIOUS_ATTEMPT_FAILED\n"
            f"Failed SQL:\n{failed_sql or '<empty>'}\n\n"
            f"Execution error:\n{previous_error}\n\n"
            "Fix the SQL according to this exact error and schema. "
            "Do not reuse invalid table names, columns or aliases.\n"
        )

    db_label = {
        DatabaseType.POSTGRESQL: "PostgreSQL",
        DatabaseType.MYSQL: "MySQL",
        DatabaseType.SQLITE: "SQLite",
    }.get(db_type, "SQL")

    return (
        f"You are a strict {db_label} Text-to-SQL generator.\n"
        "Return exactly one valid SQL SELECT query and nothing else.\n\n"
        "HARD RULES:\n"
        "1) Use ONLY tables/columns that exist in SCHEMA.\n"
        "2) Never invent table names, column names, or joins.\n"
        "3) If required data does not exist in SCHEMA, return exactly: SELECT 1 WHERE 0;\n"
        "4) Output format: plain SQL text only, no markdown, no comments, no explanations.\n"
        "5) One statement only, ending with semicolon.\n"
        "6) Read-only query: SELECT/WITH only. No INSERT/UPDATE/DELETE/DDL/PRAGMA.\n"
        "7) If user does not request a limit, add LIMIT 500.\n\n"
        "8) Every selected expression MUST have a Russian alias in double quotes using AS.\n"
        "   Example: table.col AS \"Название\", SUM(x) AS \"Сумма\".\n\n"
        "Join rules:\n"
        "- Join tables only via keys present in SCHEMA.\n"
        "- Prefer explicit JOIN ... ON ... syntax.\n\n"
        "SCHEMA:\n"
        f"{schema_ddl}\n\n"
        f"{retry_block}"
        "USER QUESTION:\n"
        f"{question}\n\n"
        "SQL:"
    )


def _extract_sql(raw: str | None) -> str:
    text = (raw or "").strip()
    if not text:
        return "SELECT 1 WHERE 0;"

    code_block = re.search(r"```(?:sql)?\s*([\s\S]*?)```", text, flags=re.IGNORECASE)
    if code_block:
        text = code_block.group(1).strip()

    text = text.strip().strip("`")
    first_stmt = text.split(";")[0].strip()
    if not first_stmt:
        return "SELECT 1 WHERE 0;"
    return f"{first_stmt};"


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


def generate_sql(
        question: str,
        previous_error: str | None = None,
        failed_sql: str | None = None,
) -> str:
    db_type = get_runtime_db_type()
    schema_ddl = _get_schema_ddl()
    prompt = _build_sql_prompt(
        question=question,
        schema_ddl=schema_ddl,
        db_type=db_type,
        previous_error=previous_error,
        failed_sql=failed_sql,
    )
    data = __process_request(prompt)
    return _extract_sql(data)


def generate_description(sql: str, user_question: str = "") -> str:
    q = (user_question or "").strip()
    q_block = f"User question: {q}\n\n" if q else "User question was not provided.\n\n"
    prompt = (
        "Write a short Russian explanation (2-4 sentences) for business users. "
        "Explain what this SQL returns in the context of the user question. "
        "No markdown, no SQL tutorial, no bullet points.\n\n"
        f"{q_block}"
        f"SQL:\n{sql}\n\n"
        "Answer in Russian:"
    )
    data = __process_request(prompt)
    out = _extract_plain_description(data)
    return out if out else "Краткое описание запроса."


def generate_questions() -> list[str]:
    schema = _get_schema_ddl()
    prompt = (
        "You are an assistant that generates SQL-related questions in Russian."
        "Given a database schema, generate exactly 3 questions in Russian about the data."
        "Requirements:"
        "- Questions must be practical and analytical (e.g., \"топ 10 заказов по цене\", \"покажи отмененные заказы\","
        " \"найди пользователей с наибольшим количеством заказов\")."
        "- Questions should be based strictly on the provided schema."
        "- Use natural, human-like Russian language (not robotic)."
        "- Avoid repeating the same pattern in all questions."
        "- Do NOT include SQL queries, only questions."
        "Output format:"
        "- Return exactly 3 questions"
        "- Separate them using a line break"
        "- No numbering, no explanations, no extra text"
        "Schema:"
        f"{schema}"
    )
    data = __process_request(prompt)
    if data is not None:
        result = map(lambda i: i.strip(), data.split("\n"))
    else:
        result = []
    return result


def __process_request(prompt: str) -> str | None:
    url = "https://foundation-models.api.cloud.ru/v1"

    client = OpenAI(
        api_key=settings.AI_API_KEY,
        base_url=url,
        timeout=180,
    )

    messages: list[ChatCompletionMessageParam] = [
        {
            "role": "user",
            "content": prompt,
        }
    ]

    response = client.chat.completions.create(
        model="Qwen/Qwen3-Coder-Next",
        max_tokens=2500,
        temperature=0.1,
        presence_penalty=0,
        top_p=0.9,
        messages=messages,
    )

    return response.choices[0].message.content
