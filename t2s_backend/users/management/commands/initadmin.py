from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import os


class Command(BaseCommand):
    help = "Создаёт суперпользователя, если его ещё нет"

    def handle(self, *args, **options):
        User = get_user_model()
        email = os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

        if not User.objects.filter(email=email).exists():
            self.stdout.write(f"Создаю суперпользователя {email}...")
            User.objects.create_superuser(
                email=email,
                password=password,
            )
        else:
            self.stdout.write(f"Суперпользователь {email} уже существует.")
