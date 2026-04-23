from django.utils import timezone
from rest_framework import serializers

from core.models import Message
from users.models import MailingRepeat


class EmailMailingCreateSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()
    emails = serializers.ListField(
        child=serializers.EmailField(),
        allow_empty=False,
        write_only=True,
    )
    comment = serializers.CharField(required=False, allow_blank=True, default="")
    repeat = serializers.ChoiceField(choices=MailingRepeat.choices)
    message_id = serializers.IntegerField(min_value=1)

    def validate_scheduled_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Дата и время рассылки должны быть в будущем.")
        return value

    def validate_emails(self, value):
        normalized = []
        seen = set()
        for email in value:
            lowered = email.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            normalized.append(lowered)
        return normalized

    def validate_message_id(self, value):
        if not Message.objects.filter(message_id=value).exists():
            raise serializers.ValidationError("Message по полю message_id не найден.")
        return value


class EmailMailingCreateResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    scheduled_at = serializers.DateTimeField()
    repeat = serializers.ChoiceField(choices=MailingRepeat.choices)
    recipients_count = serializers.IntegerField()
    periodic_task_name = serializers.CharField()
