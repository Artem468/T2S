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
    chat = models.ForeignKey("Chat", on_delete=models.CASCADE, null=False, blank=False, verbose_name="Чат")
    message = models.TextField(null=False, blank=False, verbose_name="Сообщение")
    description = models.CharField(null=True, blank=True, verbose_name="Описание", default=None)
    message_id = models.ForeignKey(
        "Message",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="Ответ на сообщение",
        related_name="answer_message_id"
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.USER,
        verbose_name="Роль"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")

    def __str__(self):
        return (self.message[:32] + "...") if len(self.message) > 32 else self.message

    class Meta:
        verbose_name = "Сообщение"
        verbose_name_plural = "Сообщения"
