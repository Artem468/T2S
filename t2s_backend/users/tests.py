from datetime import datetime, timezone

from django.test import SimpleTestCase

from users.models import MailingRepeat
from users.services import (
    build_crontab_kwargs,
    build_export_links,
    render_mailing_bodies,
)


class MailingServiceTests(SimpleTestCase):
    def test_build_export_links_returns_three_formats(self):
        links = build_export_links("https://example.com", 77)

        self.assertEqual(
            links,
            {
                "xlsx": "https://example.com/api/chats/export/77/?fmt=xlsx",
                "docx": "https://example.com/api/chats/export/77/?fmt=docx",
                "pdf": "https://example.com/api/chats/export/77/?fmt=pdf",
            },
        )

    def test_build_crontab_kwargs_for_week(self):
        scheduled_at = datetime(2026, 4, 27, 8, 45, tzinfo=timezone.utc)

        result = build_crontab_kwargs(scheduled_at, MailingRepeat.WEEK)

        self.assertEqual(result["minute"], "45")
        self.assertEqual(result["hour"], "8")
        self.assertEqual(result["day_of_week"], "mon")

    def test_render_mailing_bodies_returns_styled_html(self):
        text_body, html_body = render_mailing_bodies(
            description="Тестовое описание",
            comment="Тестовый комментарий",
            export_links={
                "xlsx": "https://example.com/xlsx",
                "docx": "https://example.com/docx",
                "pdf": "https://example.com/pdf",
            },
            unsubscribe_url="https://example.com/unsubscribe",
        )

        self.assertIn("Скачать экспорт", text_body)
        self.assertIn("<title>Рассылка T2S</title>", html_body)
        self.assertIn("Скачать XLSX", html_body)
        self.assertIn("Скачать DOCX", html_body)
        self.assertIn("Скачать PDF", html_body)
        self.assertIn("Отказаться от рассылки", html_body)
        self.assertIn("https://example.com/unsubscribe", html_body)
