from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer

from core.ai import generate_description, generate_sql


def _notify_error(chat_id: int, text: str) -> None:
    """Если LLM/Celery падает до chat.message, клиент всё равно получит ошибку по сокету."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{chat_id}",
        {
            "type": "chat.error",
            "text": text,
            "chat_id": chat_id,
        },
    )


@shared_task(
    soft_time_limit=700,
    time_limit=780,
)
def process_t2s_task(message_id: int, chat_id: int, question: str) -> str:
    channel_layer = get_channel_layer()
    room = f"chat_{chat_id}"
    try:
        sql = generate_sql(question)
        description = generate_description(sql, user_question=question)
    except Exception as exc:
        _notify_error(chat_id, str(exc))
        raise

    async_to_sync(channel_layer.group_send)(
        room,
        {
            "type": "chat.message",
            "sql": sql,
            "description": description,
            "chat_id": chat_id,
            "message_id": message_id,
        },
    )
    return sql


