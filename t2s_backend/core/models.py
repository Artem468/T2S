from django.db import models

class Role(models.TextChoices):
    USER = 'user', 'Пользователь'
    LLM = 'llm', 'Бот'


class Chat(models.Model):
    name = models.CharField(max_length=256, null=False, blank=False, verbose_name="Название")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Чат"
        verbose_name_plural = "Чаты"
        ordering = ['-created_at']


class Message(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, null=False, blank=False, verbose_name="Чат")
    message = models.TextField(null=False, blank=False, verbose_name="Сообщение")
    metadata = models.JSONField(null=True, blank=True, verbose_name="Метаданные", default=None)
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.USER,
        verbose_name="Роль"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")

    def __str__(self):
        return (self.message[:32] + "...") if len(self.message) > 32 else self.message

    def sql_for_data_query(self):
        if self.role == Role.LLM:
            return self.message
        follow = (
            Message.objects.filter(chat=self.chat, role=Role.LLM, id__gt=self.id)
            .order_by("id")
            .first()
        )
        return follow.message if follow else None

    class Meta:
        verbose_name = "Сообщение"
        verbose_name_plural = "Сообщения"
