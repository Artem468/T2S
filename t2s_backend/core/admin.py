from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from core.models import Message, Chat


class MessageInline(TabularInline):
    model = Message
    extra = 0
    fields = ('role', 'message', 'metadata', 'created_at')
    readonly_fields = ('created_at',)

@admin.register(Chat)
class ChatAdmin(ModelAdmin):
    list_display = ('id', 'name', 'created_at', 'get_messages_count')
    list_filter = ('created_at',)
    search_fields = ('name',)
    inlines = [MessageInline]

    def get_messages_count(self, obj):
        return obj.message_set.count()

    get_messages_count.short_description = "Кол-во сообщений"


@admin.register(Message)
class MessageAdmin(ModelAdmin):
    list_display = ('id', 'chat', 'role', 'message_excerpt', 'created_at')
    list_filter = ('role', 'created_at', 'chat')
    search_fields = ('message', 'chat__name')
    readonly_fields = ('created_at',)

    def message_excerpt(self, obj):
        return str(obj)

    message_excerpt.short_description = "Текст сообщения"