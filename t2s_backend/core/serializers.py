from rest_framework import serializers

from core.models import Chat, DatabaseConnection, DatabaseType, Message


class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = ["id", "name", "created_at"]


class MessagePreviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "message", "description", "created_at"]


class MessageDetailResponseSerializer(serializers.ModelSerializer):
    payload = serializers.JSONField(allow_null=True, read_only=True)
    request = serializers.CharField(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "message", "created_at", "payload", "request"]


class DatabaseConnectionSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, allow_blank=True, required=False)
    sqlite_file = serializers.FileField(
        required=False,
        allow_null=True,
        help_text="SQLite database file"
    )
    class Meta:
        model = DatabaseConnection
        fields = [
            "id",
            "db_type",
            "username",
            "password",
            "database_name",
            "host",
            "port",
            "sqlite_file",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]

    def validate(self, attrs):
        db_type = attrs.get("db_type")

        if db_type in {DatabaseType.POSTGRESQL, DatabaseType.MYSQL}:
            required_fields = ("username", "password", "database_name", "host")
            missing = [field for field in required_fields if not attrs.get(field)]
            if missing:
                raise serializers.ValidationError(
                    {field: "Это поле обязательно для выбранного типа БД." for field in missing}
                )

            if not attrs.get("port"):
                attrs["port"] = 5432 if db_type == DatabaseType.POSTGRESQL else 3306

            attrs["sqlite_file"] = None

        elif db_type == DatabaseType.SQLITE:
            sqlite_file = attrs.get("sqlite_file")
            if not sqlite_file:
                raise serializers.ValidationError(
                    {"sqlite_file": "Для SQLite необходимо передать файл базы данных."}
                )

            attrs["username"] = ""
            attrs["password"] = ""
            attrs["database_name"] = ""
            attrs["host"] = ""
            attrs["port"] = None

        return attrs


class DatabaseConnectionResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatabaseConnection
        fields = [
            "id",
            "db_type",
            "username",
            "database_name",
            "host",
            "port",
            "sqlite_file",
            "is_active",
            "created_at",
            "updated_at",
        ]
