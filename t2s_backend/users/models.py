import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from .manager import UserManager


class User(AbstractUser):
    username = None
    email = models.EmailField(
        unique=True, verbose_name="Email", help_text="Используется как логин"
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return f"{self.email}"


class MailingRepeat(models.TextChoices):
    NONE = "none", "Без повтора"
    DAY = "day", "Каждый день"
    WEEK = "week", "Каждую неделю"
    MONTH = "month", "Каждый месяц"


class EmailMailing(models.Model):
    message = models.ForeignKey(
        "core.Message",
        on_delete=models.CASCADE,
        related_name="email_mailings",
        verbose_name="Сообщение",
    )
    message_lookup_id = models.PositiveBigIntegerField(verbose_name="ID сообщения для поиска по message_id")
    scheduled_at = models.DateTimeField(verbose_name="Дата и время отправки")
    comment = models.TextField(blank=True, default="", verbose_name="Комментарий")
    repeat = models.CharField(
        max_length=10,
        choices=MailingRepeat.choices,
        default=MailingRepeat.NONE,
        verbose_name="Повторение",
    )
    periodic_task_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Имя periodic task",
    )
    is_active = models.BooleanField(default=True, verbose_name="Активна")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создана")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлена")

    class Meta:
        verbose_name = "Email-рассылка"
        verbose_name_plural = "Email-рассылки"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Рассылка #{self.pk} для message_id={self.message_lookup_id}"


class EmailMailingRecipient(models.Model):
    mailing = models.ForeignKey(
        EmailMailing,
        on_delete=models.CASCADE,
        related_name="recipients",
        verbose_name="Рассылка",
    )
    email = models.EmailField(verbose_name="Email")
    unsubscribe_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name="Токен отписки",
    )
    is_unsubscribed = models.BooleanField(default=False, verbose_name="Отписан")
    unsubscribed_at = models.DateTimeField(null=True, blank=True, verbose_name="Дата отписки")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создан")

    class Meta:
        verbose_name = "Получатель рассылки"
        verbose_name_plural = "Получатели рассылки"
        constraints = [
            models.UniqueConstraint(
                fields=["mailing", "email"],
                name="unique_email_per_mailing",
            )
        ]
        ordering = ["email"]

    def __str__(self):
        return self.email

