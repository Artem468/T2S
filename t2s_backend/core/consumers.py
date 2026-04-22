import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from core.models import Chat
from core.tasks import process_t2s_task


class ChatExecutorConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.room_group_name = None

    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        print("CLOSED WEBSOCKET", close_code)

    async def receive(self, text_data=None, bytes_data=None):
        data = json.loads(text_data)
        message_text = data.get('text', '')
        chat_id = data.get('chat_id')

        chat_obj = await self.get_or_create_chat(text=message_text, chat_id=chat_id)
        
        if self.room_group_name is None:
            self.room_group_name = f"chat_{chat_obj.id}"
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        process_t2s_task.delay(chat_id=chat_obj.id, question=message_text)

    @database_sync_to_async
    def get_or_create_chat(self, text: str, chat_id: int | None = None):
        if chat_id is not None and chat_id != "" and str(chat_id).isdigit():
            try:
                return Chat.objects.get(id=chat_id)
            except Chat.DoesNotExist:
                pass

        words = text.split()
        name = " ".join(words[:3]) if words else "Новый чат"

        return Chat.objects.create(name=name)

    async def chat_message(self, event):
        message = event['text']
        await self.send(text_data=json.dumps({
            'message': message
        }))