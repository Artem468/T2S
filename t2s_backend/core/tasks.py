from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer


@shared_task(
    soft_time_limit=300,
    time_limit=360,
)
def process_t2s_task(chat_id: int, question: str) -> str:
    sql_prompt = """
    <|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n
    Ты — опытный аналитик данных, мастер SQLite.
    Твоя задача: превратить вопрос в один идеальный SQL запрос.
    Отвечай только SQL запросом и больше ничего
    
    ПРАВИЛА:
    1. Используй только таблицы: cities (city_id, name), orders, tenders.
    2. Города всегда ищи через JOIN cities c ON o.city_id = c.city_id.
    3. НИКОГДА не делай JOIN cities по полям времени или ценам.
    4. "Сколько" = COUNT(o.order_id). "Выручка/сумма" = SUM(o.price_order_local).
    5. Если просят и то и другое, пиши: SELECT COUNT(...), SUM(...) в одном запросе.
    6. Для времени: (julianday(t2) - julianday(t1)) * 86400 (результат в секундах).
    7. Если в вопросе есть сущность, которой нет в описании таблиц (марка, имя, телефон), отвечай: -- данных нет

    ### Таблицы:
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        city_id INTEGER,
        user_id TEXT,
        driver_id TEXT,
        status_order TEXT,
        order_timestamp TEXT,
        order_modified_local TEXT,
        distance_in_meters INTEGER,
        duration_in_seconds INTEGER,
        price_order_local REAL,
        price_start_local REAL,
    );

    CREATE TABLE IF NOT EXISTS tenders (
        tender_id TEXT PRIMARY KEY,
        order_id TEXT,
        status_tender TEXT,
        tender_timestamp TEXT,
        driveraccept_timestamp TEXT,
        driverarrived_timestamp TEXT,
        driverstarttheride_timestamp TEXT,
        driverdone_timestamp TEXT,
        clientcancel_timestamp TEXT,
        drivercancel_timestamp TEXT,
        cancel_before_accept_local TEXT,
        price_tender_local REAL,
        offset_hours INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders (order_id)
    );

    ### Вопрос:
    {}

    ### SQL ответ:
    {}
    <|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n
    """



    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{chat_id}",
        {
            "type": "chat.message",
            "text": "test",
            "chat_id": chat_id,
        }
    )

    return "test"


