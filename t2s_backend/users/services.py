from datetime import timezone as dt_timezone

from django.conf import settings
from django.urls import reverse
from django.utils import timezone

from users.models import MailingRepeat


def ensure_aware_datetime(value):
    if timezone.is_naive(value):
        return timezone.make_aware(value, dt_timezone.utc)
    return value


def build_crontab_kwargs(scheduled_at, repeat):
    scheduled_at = ensure_aware_datetime(scheduled_at).astimezone(dt_timezone.utc)
    kwargs = {
        "minute": str(scheduled_at.minute),
        "hour": str(scheduled_at.hour),
        "timezone": getattr(settings, "CELERY_TIMEZONE", settings.TIME_ZONE),
    }
    if repeat == MailingRepeat.WEEK:
        kwargs["day_of_week"] = scheduled_at.strftime("%a").lower()[:3]
    elif repeat == MailingRepeat.MONTH:
        kwargs["day_of_month"] = str(scheduled_at.day)
    return kwargs


def build_export_links(base_url, message_lookup_id):
    normalized_base = base_url.rstrip("/")
    export_path = reverse("message-export", kwargs={"message_id": message_lookup_id})
    return {
        "xlsx": f"{normalized_base}{export_path}?fmt=xlsx",
        "docx": f"{normalized_base}{export_path}?fmt=docx",
        "pdf": f"{normalized_base}{export_path}?fmt=pdf",
    }


def build_unsubscribe_url(base_url, token):
    normalized_base = base_url.rstrip("/")
    return f"{normalized_base}{reverse('users:mailing-unsubscribe', kwargs={'token': token})}"


def render_mailing_bodies(description, comment, export_links, unsubscribe_url):
    description = description or "Без описания"
    comment_block = f"\nКомментарий: {comment}" if comment else ""
    text_body = (
        f"{description}{comment_block}\n\n"
        f"Скачать экспорт:\n"
        f"XLSX: {export_links['xlsx']}\n"
        f"DOCX: {export_links['docx']}\n"
        f"PDF: {export_links['pdf']}\n\n"
        f"Отписаться: {unsubscribe_url}\n"
    )
    html_parts = [
        "<html><body>",
        f"<p>{description}</p>",
    ]
    if comment:
        html_parts.append(f"<p><strong>Комментарий:</strong> {comment}</p>")
    html_parts.extend(
        [
            "<p>Скачать экспорт:</p>",
            f"<p><a href=\"{export_links['xlsx']}\">XLSX</a></p>",
            f"<p><a href=\"{export_links['docx']}\">DOCX</a></p>",
            f"<p><a href=\"{export_links['pdf']}\">PDF</a></p>",
            f"<p><a href=\"{unsubscribe_url}\">Отказаться от рассылки</a></p>",
            "</body></html>",
        ]
    )
    return text_body, "".join(html_parts)
