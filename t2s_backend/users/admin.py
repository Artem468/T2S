from django.contrib import admin
from unfold.admin import ModelAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import EmailMailing, EmailMailingRecipient, User


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    list_display = ("email", "last_name", "first_name")

    search_fields = ("email",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Персональные данные",
            {"fields": ("first_name", "last_name",)},
        ),
        (
            "Права",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Даты", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {"fields": ("email", "password1", "password2", "first_name", "last_name")},
        ),
    )

    ordering = ("email",)
    filter_horizontal = ("groups", "user_permissions")


@admin.register(EmailMailing)
class EmailMailingAdmin(ModelAdmin):
    list_display = (
        "id",
        "message_lookup_id",
        "repeat",
        "scheduled_at",
        "is_active",
    )
    list_filter = ("repeat", "is_active")
    search_fields = ("message_lookup_id", "periodic_task_name")


@admin.register(EmailMailingRecipient)
class EmailMailingRecipientAdmin(ModelAdmin):
    list_display = ("email", "mailing", "is_unsubscribed", "unsubscribed_at")
    list_filter = ("is_unsubscribed",)
    search_fields = ("email",)
