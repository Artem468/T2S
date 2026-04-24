from django.db import models


class Role(models.TextChoices):
    USER = "user", "Пользователь"
    LLM = "llm", "Бот"


class Chat(models.Model):
    name = models.CharField(max_length=256, null=False, blank=False, verbose_name="Название")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Чат"
        verbose_name_plural = "Чаты"
        ordering = ["-created_at"]


class DatabaseType(models.TextChoices):
    POSTGRESQL = "postgresql", "PostgreSQL"
    MYSQL = "mysql", "MySQL"
    SQLITE = "sqlite", "SQLite"


class DatabaseConnection(models.Model):
    db_type = models.CharField(
        max_length=32,
        choices=DatabaseType.choices,
        verbose_name="Тип БД",
    )
    username = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Логин",
    )
    password = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Пароль",
    )
    database_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="База данных",
    )
    host = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Хост",
    )
    port = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Порт",
    )
    sqlite_file = models.FileField(
        upload_to="db_files/sqlite/",
        null=True,
        blank=True,
        verbose_name="Файл SQLite",
    )
    is_active = models.BooleanField(default=False, verbose_name="Активное подключение")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлено")

    def __str__(self):
        if self.db_type == DatabaseType.SQLITE:
            return f"SQLite ({self.sqlite_file.name if self.sqlite_file else 'без файла'})"
        return f"{self.get_db_type_display()} {self.host}:{self.port}/{self.database_name}"

    class Meta:
        verbose_name = "Подключение к БД"
        verbose_name_plural = "Подключения к БД"
        ordering = ["-updated_at"]


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
        related_name="answer_message_id",
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.USER,
        verbose_name="Роль",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")

    def __str__(self):
        return (self.message[:32] + "...") if len(self.message) > 32 else self.message

    class Meta:
        verbose_name = "Сообщение"
        verbose_name_plural = "Сообщения"
