from rest_framework import serializers

from core.models import Chat, Message


class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = ['id', 'name', 'created_at']


class MessagePreviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'message', 'description', 'created_at']


class MessageDetailResponseSerializer(serializers.ModelSerializer):
    payload = serializers.JSONField(allow_null=True, read_only=True)
    request = serializers.CharField(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "message", "created_at", "payload", "request"]
