from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer

from core.ollama_client import generate_sql


@shared_task(
    soft_time_limit=300,
    time_limit=360,
)
def process_t2s_task(chat_id: int, question: str) -> str:
    sql = generate_sql(question)
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{chat_id}",
        {
            "type": "chat.message",
            "text": sql,
            "chat_id": chat_id,
        },
    )
    return sql


