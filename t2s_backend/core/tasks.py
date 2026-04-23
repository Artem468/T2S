from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings

from core.ai import generate_description, generate_sql
from core.utils.fetch_data import fetch_data


def _notify_error(chat_id: int, text: str) -> None:
    """Notify client about a processing error even if task fails before chat.message."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{chat_id}",
        {
            "type": "chat.error",
            "text": text,
            "chat_id": chat_id,
        },
    )


def _notify_retry(
    chat_id: int,
    attempt: int,
    max_attempts: int,
    error_text: str,
) -> None:
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{chat_id}",
        {
            "type": "chat.retry",
            "chat_id": chat_id,
            "attempt": attempt,
            "max_attempts": max_attempts,
            "text": (
                f"Попытка {attempt}/{max_attempts}: исправляю SQL после ошибки БД: {error_text}"
            ),
        },
    )


@shared_task(
    soft_time_limit=700,
    time_limit=780,
)
def process_t2s_task(message_id: int, chat_id: int, question: str) -> str:
    channel_layer = get_channel_layer()
    room = f"chat_{chat_id}"
    retry_count = max(0, int(getattr(settings, "TEXT2SQL_MAX_RETRIES", 2)))
    max_attempts = retry_count + 1

    last_error: str | None = None
    failed_sql: str | None = None

    try:
        sql: str | None = None
        payload: list[dict] | None = None

        for attempt_index in range(max_attempts):
            sql = generate_sql(
                question,
                previous_error=last_error,
                failed_sql=failed_sql,
            )

            try:
                payload = async_to_sync(fetch_data)(sql)
                break
            except Exception as exc:
                last_error = str(exc)
                failed_sql = sql

                if attempt_index >= retry_count:
                    raise

                _notify_retry(
                    chat_id=chat_id,
                    attempt=attempt_index + 2,
                    max_attempts=max_attempts,
                    error_text=last_error,
                )

        description = generate_description(sql or "", user_question=question)

    except Exception as exc:
        _notify_error(chat_id, str(exc))
        raise

    async_to_sync(channel_layer.group_send)(
        room,
        {
            "type": "chat.message",
            "sql": sql,
            "description": description,
            "payload": payload,
            "chat_id": chat_id,
            "message_id": message_id,
        },
    )
    return sql or ""
